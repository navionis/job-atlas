import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { Job, JobStatus } from "./types";
import type { Scope } from "./geo";

export const feedState = pgTable("feed_state", {
  feedId: text("feed_id").primaryKey(),
  jobs: jsonb("jobs").$type<Job[]>().notNull().default([]),
  nextFetch: bigint("next_fetch", { mode: "number" }).notNull().default(0),
  fetchedAt: bigint("fetched_at", { mode: "number" }).notNull().default(0),
  status: text("status").notNull().default(""),
  detail: text("detail").notNull().default(""),
});

export const feedAttempts = pgTable("feed_attempts", {
  scope: text("scope").primaryKey(),
  attempts: jsonb("attempts").$type<number[]>().notNull().default([]),
  lifetime: integer("lifetime").notNull().default(0),
});

export const jobs = pgTable(
  "jobs",
  {
    jobId: text("job_id").primaryKey(),
    source: text("source").notNull(),
    title: text("title").notNull(),
    company: text("company").notNull(),
    url: text("url").notNull(),
    location: text("location").notNull(),
    remote: boolean("remote").notNull().default(false),
    posted: timestamp("posted", { withTimezone: true }),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    scope: jsonb("scope").$type<Scope>(),
    eligibility: jsonb("eligibility").$type<Scope>(),
    summary: text("summary").notNull().default(""),
    firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
    lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("jobs_source_idx").on(t.source),
    index("jobs_posted_idx").on(t.posted.desc()),
    index("jobs_company_idx").on(t.company),
    index("jobs_last_seen_idx").on(t.lastSeen.desc()),
    index("jobs_remote_posted_idx").on(t.posted.desc()).where(sql`${t.remote}`),
    index("jobs_tags_gin").using("gin", sql`${t.tags} jsonb_path_ops`),
  ],
);

// Legacy pre-auth table — read only by the bootstrap migration into job_status_user.
export const jobStatus = pgTable("job_status", {
  jobId: text("job_id").primaryKey(),
  status: text("status").notNull(),
  updated: timestamp("updated", { withTimezone: true }).notNull().defaultNow(),
});

export const jobStatusUser = pgTable(
  "job_status_user",
  {
    email: text("email").notNull(),
    jobId: text("job_id").notNull(),
    status: text("status").$type<JobStatus>().notNull(),
    updated: timestamp("updated", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.email, t.jobId] }),
    index("job_status_user_job_idx").on(t.jobId),
    index("job_status_user_updated_idx").on(t.updated.desc()),
  ],
);

export const profiles = pgTable("profiles", {
  email: text("email").primaryKey(),
  data: jsonb("data").$type<Record<string, any>>().notNull().default({}),
});

export const feedDisabled = pgTable("feed_disabled", {
  feedId: text("feed_id").primaryKey(),
});

export const admins = pgTable("admins", {
  email: text("email").primaryKey(),
});
