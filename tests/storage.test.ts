import { test } from "node:test";
import assert from "node:assert/strict";
import { newDb } from "pg-mem";
import type { Pool } from "pg";
import { setPoolForTesting, loadState, saveState, upsertJobs } from "../lib/db";
import type { StoreState } from "../lib/db";
import type { Job } from "../lib/types";
const job = (id: string): Job => ({
  id,
  title: "Engineer",
  company: "Company",
  url: "https://example.org/" + id,
  source: "test",
  location: "Ethiopia",
  remote: true,
  posted: "2026-10-01T00:00:00.000Z",
  tags: ["go"],
  scope: {
    countries: ["ET"],
    groups: [],
    worldwide: false,
    unknown: false,
    raw: "Ethiopia",
    excluded: [],
    uncertain: false,
  },
  eligibility: { countries: [], groups: [], worldwide: false, unknown: true, raw: "", excluded: [], uncertain: false },
  summary: "Role",
});
test("postgres layer round-trips feed state and upserts jobs", async () => {
  process.env.DATABASE_URL = "postgres://pg-mem";
  const mem = newDb();
  const { Pool: MemPool } = mem.adapters.createPg();
  setPoolForTesting(new MemPool() as unknown as Pool);
  const state: StoreState = {
    entries: { remotive: { jobs: [job("j1")], next: 123, fetched: 456, status: "connected", detail: "ok" } },
    attempts: { "remotive:abc": [1, 2, 3] },
    lifetime: { "remotive:abc": 4 },
    statuses: { "user@example.com": { "remotive:j1": { status: "applied", at: 456 } } },
    disabled: ["web3career"],
  };
  await saveState(state);
  const loaded = await loadState();
  assert(loaded);
  assert.equal(loaded!.entries.remotive.status, "connected");
  assert.equal(loaded!.entries.remotive.jobs.length, 1);
  assert.deepEqual(loaded!.attempts["remotive:abc"], [1, 2, 3]);
  assert.equal(loaded!.lifetime["remotive:abc"], 4);
  assert.equal(loaded!.statuses["user@example.com"]["remotive:j1"].status, "applied");
  assert.equal(loaded!.statuses["user@example.com"]["remotive:j1"].at, 456);
  assert.deepEqual(loaded!.disabled, ["web3career"]);
  state.entries.remotive.status = "stale";
  await saveState(state);
  assert.equal((await loadState())!.entries.remotive.status, "stale");
  await upsertJobs([job("j1"), job("j2")]);
  assert.equal(mem.public.many("select job_id from jobs").length, 2);
  await upsertJobs([{ ...job("j1"), title: "Senior Engineer" }]);
  assert.equal(mem.public.many("select job_id from jobs").length, 2);
  assert.equal(mem.public.many("select title from jobs where job_id='j1'")[0].title, "Senior Engineer");
  setPoolForTesting(undefined);
  delete process.env.DATABASE_URL;
});
