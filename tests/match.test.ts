import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreJob, rankJobs } from "../lib/match";
import type { Job } from "../lib/types";

const scope = () => ({
  countries: [] as string[],
  groups: [] as string[],
  worldwide: false,
  unknown: true,
  raw: "",
  excluded: [] as string[],
  uncertain: false,
});
const job = (over: Partial<Job>): Job => ({
  id: "j1",
  title: "Engineer",
  company: "Acme",
  url: "https://example.org/j1",
  source: "remotive:x",
  location: "Remote",
  remote: true,
  posted: "2026-10-01T00:00:00.000Z",
  tags: [],
  scope: scope(),
  eligibility: scope(),
  summary: "",
  ...over,
});

test("title hit outweighs summary-only hit", () => {
  const title = scoreJob(job({ title: "Senior React Engineer" }), ["react"], []);
  const summary = scoreJob(job({ summary: "we use react daily" }), ["react"], []);
  const meta = scoreJob(job({ company: "React Labs" }), ["react"], []);
  assert(title && summary && meta);
  assert(title.score > summary.score);
  assert(summary.score > meta.score);
  assert.equal(title.hits[0], "react");
});

test("excluded term in job text drops the job entirely", () => {
  const m = scoreJob(job({ title: "Java Engineer", summary: "senior java role" }), ["java"], ["senior"]);
  assert.equal(m, null);
  const keep = scoreJob(job({ title: "Java Engineer" }), ["java"], ["php"]);
  assert(keep);
});

test("no keyword hits and sub-2-char keywords produce no match", () => {
  assert.equal(scoreJob(job({ title: "Designer" }), ["rust", "go"], []), null);
  assert.equal(scoreJob(job({ title: "C Programmer" }), ["c"], []), null);
});

test("rankJobs applies source rank multiplier, threshold and sort order", () => {
  const jobs = [
    job({ id: "a", title: "React Dev", source: "weak:1", posted: "2026-10-02T00:00:00.000Z" }),
    job({ id: "b", title: "React Dev", source: "strong:1", posted: "2026-10-01T00:00:00.000Z" }),
    job({ id: "c", title: "Designer", source: "strong:1" }),
  ];
  const ranked = rankJobs(jobs, ["react"], [], { weak: 1, strong: 5 });
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].job.id, "b"); // higher source rank wins over newer post
  assert(ranked.every((m) => m.score >= 15));
  assert.equal(ranked[0].hits[0], "react");
});

test("rankJobs tie-breaks equal scores by newer posted date", () => {
  const jobs = [
    job({ id: "old", title: "React Dev", posted: "2026-09-01T00:00:00.000Z" }),
    job({ id: "new", title: "React Dev", posted: "2026-10-01T00:00:00.000Z" }),
  ];
  const ranked = rankJobs(jobs, ["react"], [], {});
  assert.equal(ranked[0].job.id, "new");
});
