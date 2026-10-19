import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { catalog } from "./catalog";
import { feeds, FEED_UA, H, type Feed } from "./feed-adapters";
export { feeds, type Feed } from "./feed-adapters";
import {
  pgEnabled,
  loadState,
  saveState,
  upsertJobs,
  dbSetJobStatus,
  dbDeleteJobStatus,
  dbListJobStatuses,
  dbSetFeedDisabled,
  dbSetAdmin,
  dbSaveFeed,
  dbSaveAttempts,
} from "./db";
import { listProfileEmails } from "./profiles";
import { stampServerTime } from "./time";
import type { StoreState } from "./db";
import type { Job, JobStatus, Snapshot, SourceStatus, StatusEntry } from "./types";

const dir = process.env.DATA_DIR || join(process.cwd(), ".data");
const file = join(dir, "feeds.json");
function load(): StoreState {
  try {
    const d = JSON.parse(readFileSync(file, "utf8"));
    if (!d.entries || !d.attempts || !d.lifetime) throw Error();
    const nested: StoreState["statuses"] = {};
    for (const [k, v] of Object.entries((d.statuses || {}) as Record<string, any>)) {
      if (typeof v === "string" || (v && typeof v.status === "string"))
        (nested["*"] ??= {})[k] = typeof v === "string" ? { status: v, at: 0 } : v;
      else nested[k] = v;
    }
    d.statuses = nested;
    d.disabled = Array.isArray(d.disabled) ? d.disabled.filter((x: any) => typeof x === "string") : [];
    d.admins = Array.isArray(d.admins) ? d.admins.filter((x: any) => typeof x === "string") : [];
    return d;
  } catch (e: any) {
    if (e.code !== "ENOENT") throw new Error("Cannot read feed state; restore it before fetching to preserve quotas.");
    return { entries: {}, attempts: {}, lifetime: {}, statuses: {}, disabled: [], admins: [] };
  }
}
const globalState = globalThis as typeof globalThis & {
  atlas?: { state: StoreState; pending?: Promise<Snapshot>; hydrated?: Promise<void>; pg?: boolean };
};
const shared = (globalState.atlas ??= { state: load() });
shared.hydrated ??= (async () => {
  if (pgEnabled()) {
    const s = await loadState();
    if (s) {
      shared.state = s;
      shared.pg = true;
    } else shared.pg = false;
  } else shared.pg = false;
})();
function statusesFor(email: string) {
  const all = shared.state.statuses;
  return { ...(all["*"] || {}), ...(all[email] || {}) };
}
export async function setJobStatus(email: string, id: string, status: JobStatus) {
  await shared.hydrated;
  const all = shared.state.statuses;
  const mine = (all[email] ??= {});
  if (all["*"]) {
    for (const [k, v] of Object.entries(all["*"])) mine[k] ??= v;
    delete all["*"];
  }
  if (status === "listed") delete mine[id];
  else mine[id] = { status, at: Date.now() };
  statusCache.delete(email);
  if (shared.pg) {
    if (status === "listed") await dbDeleteJobStatus(email, id);
    else await dbSetJobStatus(email, id, status, Date.now());
  } else await save();
}
export async function isAdminUser(email: string): Promise<boolean> {
  await shared.hydrated;
  const em = email.toLowerCase();
  if (!em) return false;
  const env = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (env.includes(em)) return true;
  const a = shared.state.admins || [];
  return a.length === 0 || a.includes(em);
}
// First verified Google sign-in claims the admin seat; ADMIN_EMAILS grants extras.
export async function ensureAdmin(email: string) {
  await shared.hydrated;
  const a = (shared.state.admins ??= []);
  if (a.length === 0 && email) {
    a.push(email.toLowerCase());
    if (shared.pg) await dbSetAdmin(email.toLowerCase(), true);
    else await save();
  }
}
export async function setAdmin(email: string, on: boolean) {
  await shared.hydrated;
  const a = (shared.state.admins ??= []);
  const em = email.toLowerCase();
  const i = a.indexOf(em);
  if (on && i < 0) a.push(em);
  if (!on && i >= 0) a.splice(i, 1);
  if (shared.pg) await dbSetAdmin(em, on);
  else await save();
}
export async function listUsers(): Promise<{ email: string; admin: boolean; viaEnv: boolean; marked: number }[]> {
  await shared.hydrated;
  const env = new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean),
  );
  const emails = new Set<string>([
    ...(shared.state.admins || []),
    ...Object.keys(shared.state.statuses || {}).filter((e) => e !== "*"),
    ...(await listProfileEmails()),
    ...env,
  ]);
  return [...emails].sort().map((email) => ({
    email,
    admin: env.has(email) || (shared.state.admins || []).includes(email),
    viaEnv: env.has(email),
    marked: Object.keys(shared.state.statuses[email] || {}).length,
  }));
}
export async function setSourceDisabled(id: string, disabled: boolean) {
  await shared.hydrated;
  const known = feeds().some((f) => f.id === id);
  if (!known) throw new Error("Unknown source");
  const list = (shared.state.disabled ??= []);
  const i = list.indexOf(id);
  if (disabled && i < 0) list.push(id);
  if (!disabled && i >= 0) list.splice(i, 1);
  baseCache = null;
  if (shared.pg) await dbSetFeedDisabled(id, disabled);
  else await save();
}
async function save() {
  if (shared.pg) await saveState(shared.state);
  else {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file + ".tmp", JSON.stringify(shared.state));
    renameSync(file + ".tmp", file);
  }
}
export function retryDelay(value: string | null, now = Date.now()) {
  if (!value) return 15 * 60000;
  const n = Number(value);
  return Number.isFinite(n)
    ? Math.max(60000, n * 1000)
    : Math.max(60000, (Date.parse(value) || now + 15 * 60000) - now);
}
function reserve(f: Feed) {
  const now = Date.now(),
    scope =
      f.provider +
      ":" +
      createHash("sha256")
        .update(
          f.provider === "jooble"
            ? process.env.JOOBLE_API_KEY || ""
            : f.provider === "adzuna"
              ? process.env.ADZUNA_APP_ID || ""
              : "public",
        )
        .digest("hex")
        .slice(0, 16);
  const a = (shared.state.attempts[scope] || []).filter((t) => now - t < 31 * 24 * H);
  const limits =
    f.provider === "adzuna"
      ? [
          [60000, 25],
          [24 * H, 250],
          [7 * 24 * H, 1000],
          [31 * 24 * H, 2500],
        ]
      : f.provider === "remotive"
        ? [
            [24 * H, 4],
            [60000, 2],
          ]
        : [];
  if (limits.some(([window, max]) => a.filter((t) => now - t < window).length >= max))
    throw Error("Local quota reached; cached results retained");
  if (f.provider === "jooble" && (shared.state.lifetime[scope] || 0) >= 500)
    throw Error("Local Jooble lifetime budget exhausted");
  shared.state.attempts[scope] = [...a, now];
  shared.state.lifetime[scope] = (shared.state.lifetime[scope] || 0) + 1;
  return scope;
}
// Persist only what a refresh touched — one feed_state row + its attempt scope.
// A whole-state saveState() would serialize every feed's jobs JSON per call.
async function persistFeed(f: Feed, scope: string) {
  if (shared.pg) {
    const e = shared.state.entries[f.id];
    if (!e) return;
    const ops: Promise<void>[] = [dbSaveFeed(f.id, e)];
    if (scope) ops.push(dbSaveAttempts(scope, shared.state.attempts[scope] || [], shared.state.lifetime[scope] || 0));
    await Promise.all(ops);
  } else await save();
}
const jobSigs = new Map<string, string>();
async function refresh(f: Feed, force = false) {
  await shared.hydrated;
  let e = shared.state.entries[f.id];
  if (!force && e && e.next > Date.now()) return;
  e ??= { jobs: [], next: 0, fetched: 0, status: "loading", detail: "" };
  shared.state.entries[f.id] = e;
  e.next = Date.now() + f.ttl;
  let scope = "";
  try {
    await shared.hydrated;
    scope = reserve(f);
    await persistFeed(f, scope); // Reserve before network, including failed calls.
    const requests: { url: string; init?: RequestInit }[] = [{ url: f.url, init: f.init }];
    for (let p = 2; p <= (f.pages || 1); p++) requests.push(f.pageUrl!(p));
    const jobs: Job[] = [];
    const request = (r: { url: string; init?: RequestInit }) =>
      fetch(r.url, {
        ...r.init,
        headers: {
          "User-Agent": FEED_UA,
          Accept: f.html ? "text/html, */*" : "application/json",
          "Accept-Language": "en-US,en;q=0.9",
          ...r.init?.headers,
        },
        signal: AbortSignal.timeout(18000),
        cache: "no-store",
        redirect: "error",
      });
    let detail =
      f.provider === "remotive"
        ? "Provider listings delayed by 24 hours"
        : "Latest configured feed slice; see coverage";
    try {
      for (const r of requests) {
        let response = await request(r);
        // CDN bot checks (e.g. Cloudflare on hnhiring) flap 403s; one delayed
        // retry usually clears them — otherwise the feed is parked for its TTL.
        if (response.status === 403) {
          await new Promise((res) => setTimeout(res, 2500));
          response = await request(r);
        }
        if (!response.ok) {
          if (response.status === 429 || response.status === 503)
            e.next = Math.max(e.next, Date.now() + retryDelay(response.headers.get("retry-after")));
          throw Error(`Provider returned HTTP ${response.status}`);
        }
        jobs.push(...f.map(f.html ? await response.text() : await response.json()));
      }
    } catch (err) {
      if (!f.fallback) throw err;
      // Primary source failed (bot check, outage) — pull the same data from
      // the fallback source rather than parking the feed. Clear partial
      // pages so fallback output isn't mixed with half-fetched primary data.
      jobs.length = 0;
      jobs.push(...(await f.fallback()));
      detail = "Primary unreachable — served via HN thread mirror";
    }
    const found = jobs.filter((j) => j.title && j.url);
    e.jobs = found;
    e.fetched = Date.now();
    e.status = "connected";
    e.detail = detail;
    if (shared.pg) {
      // Skip the multi-hundred-row upsert when the feed content is identical
      // to the last successful write.
      const sig = createHash("sha1")
        .update(found.map((j) => j.id + j.url + j.posted + j.title + j.company + j.location).join("\n"))
        .digest("hex");
      if (jobSigs.get(f.id) !== sig) {
        await upsertJobs(found);
        jobSigs.set(f.id, sig);
      }
    }
  } catch (error) {
    // A failed fetch must not park the feed for a whole TTL — retry in 15 min.
    // A Retry-After hint longer than the TTL (from the 429/503 path) still wins.
    if (e.next <= Date.now() + f.ttl + 1000) e.next = Date.now() + 15 * 60000;
    e.status = e.jobs.length ? "stale" : "unavailable";
    e.detail =
      error instanceof Error && /^(Provider returned|Local )/.test(error.message)
        ? error.message
        : "Could not retrieve feed; check server network and source configuration";
  }
  await persistFeed(f, scope);
}
let baseCache: { snap: Snapshot; feedsKey: string } | null = null;
/** Refresh due feeds (or all when forced), stalest-first, 3 at a time. */
export async function syncAll(force = false): Promise<{
  refreshed: string[];
  failed: { id: string; error: string }[];
  skipped: number;
  jobs: number;
  took: number;
}> {
  const t0 = Date.now();
  await shared.hydrated;
  const disabled = new Set(shared.state.disabled || []);
  const due = feeds()
    .filter((f) => !disabled.has(f.id))
    .sort((a, b) => (shared.state.entries[a.id]?.next || 0) - (shared.state.entries[b.id]?.next || 0));
  const refreshed: string[] = [];
  const failed: { id: string; error: string }[] = [];
  let skipped = 0;
  for (let i = 0; i < due.length; i += 3) {
    await Promise.all(
      due.slice(i, i + 3).map(async (f) => {
        const e = shared.state.entries[f.id];
        if (!force && e && e.next > Date.now()) {
          skipped++;
          return;
        }
        await refresh(f, force);
        const after = shared.state.entries[f.id];
        if (after?.status === "connected") refreshed.push(f.id);
        else failed.push({ id: f.id, error: after?.detail || "unknown" });
      }),
    );
  }
  baseCache = null;
  const jobs = new Set(
    feeds()
      .filter((f) => !disabled.has(f.id))
      .flatMap((f) => shared.state.entries[f.id]?.jobs || [])
      .map((j) => j.url),
  ).size;
  return { refreshed, failed, skipped, jobs, took: Date.now() - t0 };
}
let refreshing = false;
async function refreshAll(enabled: Feed[]) {
  refreshing = true;
  try {
    // Three concurrent upstream requests; no per-viewer polling amplification.
    for (let i = 0; i < enabled.length; i += 3) await Promise.all(enabled.slice(i, i + 3).map((f) => refresh(f)));
    baseCache = null;
  } finally {
    refreshing = false;
  }
}
async function collect(): Promise<Snapshot> {
  await shared.hydrated;
  const configured = feeds();
  const disabled = new Set(shared.state.disabled || []);
  const enabled = configured.filter((f) => !disabled.has(f.id));
  const feedsKey = configured.map((f) => f.id).join(",") + "|" + [...disabled].sort().join(",");
  // Reuse the assembled snapshot when no feed is due — refresh() is a no-op
  // until its TTL elapses, so jobs/sources cannot change between those points.
  const due = enabled.some((f) => {
    const e = shared.state.entries[f.id];
    return !e || e.next <= Date.now();
  });
  if (!due && baseCache && baseCache.feedsKey === feedsKey) return baseCache.snap;
  // Warm path: serve the cached snapshot instantly and refresh upstream in the
  // background — page renders, SSE ticks and /api/jobs polls must not block on
  // provider fetches. A cold start (nothing cached yet) still awaits so the
  // first paint has data.
  const hasData = enabled.some((f) => (shared.state.entries[f.id]?.jobs.length || 0) > 0);
  if (due) {
    if (hasData) {
      if (!refreshing) void refreshAll(enabled);
    } else if (!refreshing) await refreshAll(enabled);
    // else: a cold-start refresh is already in flight — serve what's cached.
  }
  const sources: SourceStatus[] = configured.map((f) => {
    const e = shared.state.entries[f.id];
    if (disabled.has(f.id))
      return {
        id: f.id,
        name: catalog.find((c) => c.id === f.provider)!.name + (f.id.includes(":") ? " · " + f.id.split(":")[1] : ""),
        status: "disabled",
        count: e?.jobs.length || 0,
        fetchedAt: e?.fetched || 0,
        nextFetch: 0,
        detail: "Disabled — not fetching; cached listings hidden",
      };
    return {
      id: f.id,
      name: catalog.find((c) => c.id === f.provider)!.name + (f.id.includes(":") ? " · " + f.id.split(":")[1] : ""),
      status: e.status,
      count: e.jobs.length,
      fetchedAt: e.fetched,
      nextFetch: e.next,
      detail: e.detail,
    };
  });
  for (const c of catalog.filter((c) => c.implemented && !configured.some((f) => f.provider === c.id)))
    sources.push({
      id: c.id,
      name: c.name,
      status: "not configured",
      count: 0,
      fetchedAt: 0,
      nextFetch: 0,
      detail: "Add credentials or board slugs in .env.local",
    });
  const seen = new Set<string>();
  const jobs = enabled
    .flatMap((f) => shared.state.entries[f.id]?.jobs || [])
    .filter((j) => {
      const k = j.url.split("?")[0];
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => b.posted.localeCompare(a.posted));
  const snap = { jobs, sources, statuses: {}, updatedAt: Math.max(0, ...sources.map((s) => s.fetchedAt)) };
  baseCache = { snap, feedsKey };
  return snap;
}
const statusCache = new Map<string, { at: number; v: Record<string, StatusEntry> }>();
const STATUS_TTL = 8000;
export async function snapshot(email = ""): Promise<Snapshot> {
  if (!shared.pending)
    shared.pending = collect().finally(() => {
      shared.pending = undefined;
    });
  const base = await shared.pending;
  // Fresh per-user read — other processes (deployed app, sync script) may have
  // written marks since this process hydrated its in-memory mirror. Bounded by
  // a short TTL so renders/polls don't hit Postgres per call.
  let fresh: Record<string, StatusEntry> | null = null;
  if (shared.pg && email) {
    const hit = statusCache.get(email);
    if (hit && Date.now() - hit.at < STATUS_TTL) fresh = hit.v;
    else {
      fresh = await dbListJobStatuses(email);
      if (fresh) statusCache.set(email, { at: Date.now(), v: fresh });
    }
  }
  return { ...base, statuses: fresh ?? statusesFor(email) };
}
const emptySnapshot = (): Snapshot => ({ jobs: [], sources: [], statuses: {}, updatedAt: 0 });
/** Snapshot for page render — never throws, and stamped with the server clock. */
export async function loadSnapshot(email = ""): Promise<Snapshot> {
  return stampServerTime(await snapshot(email).catch(emptySnapshot));
}
