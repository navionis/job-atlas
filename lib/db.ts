import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import * as tables from "./schema";
import {
  admins,
  emailTokens,
  feedAttempts,
  feedDisabled,
  feedState,
  jobs as jobsTable,
  jobStatusUser,
  profiles,
} from "./schema";
import type { Job, StatusEntry } from "./types";

type Entry = { jobs: Job[]; next: number; fetched: number; status: string; detail: string };
export type StoreState = {
  entries: Record<string, Entry>;
  attempts: Record<string, number[]>;
  lifetime: Record<string, number>;
  statuses: Record<string, Record<string, StatusEntry>>;
  disabled: string[];
  admins: string[];
};

let pool: Pool | undefined, db: NodePgDatabase<typeof tables> | undefined, boot: Promise<Pool> | undefined;

/** timestamptz reads — Date from node-pg, string from pg-mem. */
const ts = (v: Date | string | null | undefined) => (v instanceof Date ? v.getTime() : new Date(v || 0).getTime() || 0);

export function pgEnabled() {
  return !!process.env.DATABASE_URL;
}
export async function dbPing(): Promise<boolean> {
  try {
    await (await conn()).pool.query("select 1");
    return true;
  } catch {
    return false;
  }
}
// An sslmode/ssl query param in the URL would override the explicit ssl option; DATABASE_SSL owns it.
function connStr() {
  const cs = process.env.DATABASE_URL || "";
  if (process.env.DATABASE_SSL !== "true") return cs;
  try {
    const u = new URL(cs);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("ssl");
    return u.href;
  } catch {
    return cs;
  }
}
export function setPoolForTesting(p: Pool | undefined) {
  if (p) {
    // pg-mem lacks getTypeParser and rowMode:"array" — strip both and emulate
    // array rows from the fields list so drizzle's mapper sees what it expects.
    const raw = p.query.bind(p) as any;
    (p as any).query = (config: any, values?: any, cb?: any) => {
      // pg-mem only honors query(text, values) — unwrap drizzle's config object
      // (it can't run getTypeParser/rowMode anyway), then emulate array rows
      // from the fields list so drizzle's mapper sees what it expects.
      const wantArray = config && typeof config === "object" && config.rowMode === "array";
      const res = raw(typeof config === "object" ? config.text : config, values, cb);
      if (!wantArray || typeof res?.then !== "function") return res;
      return res.then((r: any) => {
        if (!r?.rows) return r;
        // pg-mem emits an empty fields list; its row objects preserve select
        // order, so Object.values is a faithful array-row emulation.
        const toArr = r.fields?.length
          ? (row: any) => r.fields.map((f: any) => row[f.name])
          : (row: any) => Object.values(row);
        return { ...r, rows: r.rows.map(toArr) };
      });
    };
  }
  pool = p;
  db = p ? drizzle(p, { schema: tables }) : undefined;
  boot = undefined;
}
async function conn(): Promise<{ pool: Pool; db: NodePgDatabase<typeof tables> }> {
  if (!pgEnabled()) throw new Error("DATABASE_URL is not configured");
  if (!boot)
    boot = (async () => {
      if (!pool) {
        pool = new Pool({
          connectionString: connStr(),
          max: 3,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
          ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
        });
        pool.on("error", () => {});
        db = drizzle(pool, { schema: tables });
      }
      // Table DDL stays raw — idempotent bootstrap is the deployment's
      // zero-config path; drizzle-kit can diff ./schema.ts for managed migrations.
      await pool.query(
        `create table if not exists feed_state(feed_id text primary key,jobs jsonb not null default '[]',next_fetch bigint not null default 0,fetched_at bigint not null default 0,status text not null default '',detail text not null default '')`,
      );
      await pool.query(
        `create table if not exists feed_attempts(scope text primary key,attempts jsonb not null default '[]',lifetime integer not null default 0)`,
      );
      await pool.query(
        `create table if not exists jobs(job_id text primary key,source text not null,title text not null,company text not null,url text not null,location text not null,remote boolean not null default false,posted timestamptz,tags jsonb not null default '[]',scope jsonb,eligibility jsonb,summary text not null default '',first_seen timestamptz not null default now(),last_seen timestamptz not null default now())`,
      );
      await pool.query(`create index if not exists jobs_source_idx on jobs(source)`);
      await pool.query(`create index if not exists jobs_posted_idx on jobs(posted desc)`);
      await pool.query(`create index if not exists jobs_company_idx on jobs(company)`);
      await pool.query(`create index if not exists jobs_last_seen_idx on jobs(last_seen desc)`);
      // Remote-first queries hit a compact partial index instead of full scans.
      await pool.query(`create index if not exists jobs_remote_posted_idx on jobs(posted desc) where remote`);
      // Tag containment lookups (tags @> '["react"]') use jsonb_path_ops GIN.
      await pool.query(`create index if not exists jobs_tags_gin on jobs using gin(tags jsonb_path_ops)`);
      await pool.query(
        `create table if not exists job_status(job_id text primary key,status text not null,updated timestamptz not null default now())`,
      );
      await pool.query(
        `create table if not exists job_status_user(email text not null,job_id text not null,status text not null,updated timestamptz not null default now(),primary key(email,job_id))`,
      );
      // Reverse direction of the (email,job_id) PK: who marked a given job.
      await pool.query(`create index if not exists job_status_user_job_idx on job_status_user(job_id)`);
      // "Recent pipeline activity" lookups across a user's marks.
      await pool.query(`create index if not exists job_status_user_updated_idx on job_status_user(updated desc)`);
      // Migrate pre-auth global statuses into a legacy bucket shared until a user adopts them.
      await pool.query(
        `insert into job_status_user(email,job_id,status,updated) select '*',job_id,status,updated from job_status on conflict do nothing`,
      );
      await pool.query(`create table if not exists profiles(email text primary key,data jsonb not null default '{}')`);
      await pool.query(`create table if not exists feed_disabled(feed_id text primary key)`);
      await pool.query(`create table if not exists admins(email text primary key)`);
      await pool.query(
        `create table if not exists email_tokens(hash text primary key,email text not null,expires_at timestamptz not null,used_at timestamptz)`,
      );
      return pool;
    })().catch((e) => {
      boot = undefined;
      throw e;
    });
  await boot;
  return { pool: pool!, db: db! };
}

export async function loadState(): Promise<StoreState | null> {
  try {
    const { db } = await conn();
    const [e, a, s, d, adm] = await Promise.all([
      db.select().from(feedState),
      db.select().from(feedAttempts),
      db.select().from(jobStatusUser),
      db.select().from(feedDisabled),
      db.select().from(admins),
    ]);
    const state: StoreState = {
      entries: {},
      attempts: {},
      lifetime: {},
      statuses: {},
      disabled: d.map((r) => r.feedId),
      admins: adm.map((r) => r.email),
    };
    for (const r of e)
      state.entries[r.feedId] = {
        jobs: r.jobs,
        next: r.nextFetch,
        fetched: r.fetchedAt,
        status: r.status,
        detail: r.detail,
      };
    for (const r of a) {
      state.attempts[r.scope] = r.attempts;
      state.lifetime[r.scope] = r.lifetime;
    }
    for (const r of s)
      if (["listed", "applied", "cancelled", "ignored"].includes(r.status))
        (state.statuses[r.email] ??= {})[r.jobId] = {
          status: r.status,
          at: ts(r.updated),
        };
    return state;
  } catch {
    return null;
  }
}

/** Chunked insert — keeps parameter counts sane on large batches. */
async function insertChunks<T>(rows: T[], run: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += 100) await run(rows.slice(i, i + 100));
}

export async function saveState(state: StoreState) {
  try {
    const { db } = await conn();
    await insertChunks(
      Object.entries(state.entries).map(([feedId, e]) => ({
        feedId,
        jobs: e.jobs,
        nextFetch: e.next,
        fetchedAt: e.fetched,
        status: e.status,
        detail: e.detail,
      })),
      (rows) =>
        db
          .insert(feedState)
          .values(rows)
          .onConflictDoUpdate({
            target: feedState.feedId,
            set: {
              jobs: sql`excluded.jobs`,
              nextFetch: sql`excluded.next_fetch`,
              fetchedAt: sql`excluded.fetched_at`,
              status: sql`excluded.status`,
              detail: sql`excluded.detail`,
            },
          }),
    );
    await insertChunks(
      Object.entries(state.attempts).map(([scope, attempts]) => ({
        scope,
        attempts,
        lifetime: state.lifetime[scope] || 0,
      })),
      (rows) =>
        db
          .insert(feedAttempts)
          .values(rows)
          .onConflictDoUpdate({
            target: feedAttempts.scope,
            set: { attempts: sql`excluded.attempts`, lifetime: sql`excluded.lifetime` },
          }),
    );
    // User-owned rows (statuses, disabled feeds, admins) are written by the
    // targeted ops below — never bulk-reconciled here, or a stale in-memory
    // copy from another process would clobber fresh marks/toggles.
  } catch {}
}

export async function dbSetJobStatus(email: string, jobId: string, status: string, at: number) {
  try {
    const { db } = await conn();
    const updated = new Date(at || Date.now());
    await db
      .insert(jobStatusUser)
      .values({ email, jobId, status: status as StatusEntry["status"], updated })
      .onConflictDoUpdate({
        target: [jobStatusUser.email, jobStatusUser.jobId],
        set: { status: sql`excluded.status`, updated: sql`excluded.updated` },
      });
  } catch {}
}
export async function dbDeleteJobStatus(email: string, jobId: string) {
  try {
    const { db } = await conn();
    await db.delete(jobStatusUser).where(and(eq(jobStatusUser.email, email), eq(jobStatusUser.jobId, jobId)));
  } catch {}
}
export async function dbSaveFeed(id: string, e: Entry) {
  try {
    const { db } = await conn();
    await db
      .insert(feedState)
      .values({
        feedId: id,
        jobs: e.jobs,
        nextFetch: e.next,
        fetchedAt: e.fetched,
        status: e.status,
        detail: e.detail,
      })
      .onConflictDoUpdate({
        target: feedState.feedId,
        set: {
          jobs: sql`excluded.jobs`,
          nextFetch: sql`excluded.next_fetch`,
          fetchedAt: sql`excluded.fetched_at`,
          status: sql`excluded.status`,
          detail: sql`excluded.detail`,
        },
      });
  } catch {}
}
export async function dbSaveAttempts(scope: string, attempts: number[], lifetime: number) {
  try {
    const { db } = await conn();
    await db
      .insert(feedAttempts)
      .values({ scope, attempts, lifetime })
      .onConflictDoUpdate({
        target: feedAttempts.scope,
        set: { attempts: sql`excluded.attempts`, lifetime: sql`excluded.lifetime` },
      });
  } catch {}
}
export async function dbListJobStatuses(email: string): Promise<Record<string, StatusEntry> | null> {
  try {
    const { db } = await conn();
    const rows = await db
      .select()
      .from(jobStatusUser)
      .where(or(eq(jobStatusUser.email, email), eq(jobStatusUser.email, "*")))
      .orderBy(sql`case when ${jobStatusUser.email} = '*' then 0 else 1 end`);
    const out: Record<string, StatusEntry> = {};
    for (const r of rows)
      if (["listed", "applied", "cancelled", "ignored"].includes(r.status))
        out[r.jobId] = { status: r.status, at: ts(r.updated) };
    return out;
  } catch {
    return null;
  }
}
export async function dbSetFeedDisabled(id: string, on: boolean) {
  try {
    const { db } = await conn();
    if (on) await db.insert(feedDisabled).values({ feedId: id }).onConflictDoNothing();
    else await db.delete(feedDisabled).where(eq(feedDisabled.feedId, id));
  } catch {}
}
export async function dbSetAdmin(email: string, on: boolean) {
  try {
    const { db } = await conn();
    if (on) await db.insert(admins).values({ email }).onConflictDoNothing();
    else await db.delete(admins).where(eq(admins.email, email));
  } catch {}
}
export async function dbListProfileEmails(): Promise<string[]> {
  try {
    const { db } = await conn();
    const rows = await db.select({ email: profiles.email }).from(profiles);
    return rows.map((r) => r.email);
  } catch {
    return [];
  }
}
export async function dbLoadProfile(email: string): Promise<any | null> {
  try {
    const { db } = await conn();
    const rows = await db.select({ data: profiles.data }).from(profiles).where(eq(profiles.email, email));
    return rows[0]?.data || null;
  } catch {
    return null;
  }
}
export async function dbSaveProfile(email: string, data: any) {
  try {
    const { db } = await conn();
    await db
      .insert(profiles)
      .values({ email, data })
      .onConflictDoUpdate({ target: profiles.email, set: { data: sql`excluded.data` } });
  } catch {}
}
export async function dbCreateEmailToken(hash: string, email: string, expiresAt: number) {
  try {
    const { db } = await conn();
    await db.insert(emailTokens).values({ hash, email, expiresAt: new Date(expiresAt) });
  } catch {}
}
/** Atomic single-use consume — sets used_at iff the token is still unused. */
export async function dbConsumeEmailToken(hash: string): Promise<string | null> {
  try {
    const { db } = await conn();
    const rows = await db
      .update(emailTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(emailTokens.hash, hash), isNull(emailTokens.usedAt)))
      .returning({ email: emailTokens.email, expiresAt: emailTokens.expiresAt });
    const r = rows[0];
    return r && r.expiresAt.getTime() > Date.now() ? r.email : null;
  } catch {
    return null;
  }
}
export async function upsertJobs(rows: Job[]) {
  try {
    const { db } = await conn();
    await insertChunks(
      rows.map((j) => ({
        jobId: j.id,
        source: j.source,
        title: j.title,
        company: j.company,
        url: j.url,
        location: j.location,
        remote: j.remote,
        posted: j.posted ? new Date(j.posted) : null,
        tags: j.tags,
        scope: j.scope,
        eligibility: j.eligibility,
        summary: j.summary,
      })),
      (chunk) =>
        db
          .insert(jobsTable)
          .values(chunk)
          .onConflictDoUpdate({
            target: jobsTable.jobId,
            set: {
              title: sql`excluded.title`,
              company: sql`excluded.company`,
              url: sql`excluded.url`,
              location: sql`excluded.location`,
              remote: sql`excluded.remote`,
              posted: sql`excluded.posted`,
              tags: sql`excluded.tags`,
              summary: sql`excluded.summary`,
              lastSeen: sql`now()`,
            },
          }),
    );
  } catch {}
}
