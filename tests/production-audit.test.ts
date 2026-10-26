import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "../lib/auth";
import { isNonJob } from "../lib/feeds";
import type { Job } from "../lib/types";

const job = (over: Partial<Job>): Job => ({
  id: "src:x",
  source: "cryptojobs",
  title: "Software Engineer",
  company: "Acme",
  url: "https://example.com/j/1",
  location: "London, UK",
  remote: true,
  posted: "2025-01-01T00:00:00.000Z",
  tags: [],
  scope: { countries: [], groups: [], worldwide: false, unknown: false, raw: "", excluded: [], uncertain: false },
  eligibility: { countries: [], groups: [], worldwide: false, unknown: false, raw: "", excluded: [], uncertain: false },
  summary: "",
  ...over,
});

// ---- safeNext ---------------------------------------------------------

test("safeNext keeps internal paths incl. query strings", () => {
  assert.equal(safeNext("/jobs/abc"), "/jobs/abc");
  assert.equal(safeNext("/jobs?q=london&days=24h"), "/jobs?q=london&days=24h");
  assert.equal(safeNext("/"), "/");
});

test("safeNext rejects external, protocol-relative, and backslash targets", () => {
  assert.equal(safeNext("https://evil.com"), "/");
  assert.equal(safeNext("//evil.com"), "/");
  assert.equal(safeNext("/\\evil.com"), "/");
  assert.equal(safeNext("javascript:alert(1)"), "/");
  assert.equal(safeNext(""), "/");
  assert.equal(safeNext(null), "/");
  assert.equal(safeNext(undefined), "/");
});

// ---- isNonJob ---------------------------------------------------------
// Signatures lifted verbatim from the live probe rows that were removed.

test("isNonJob catches self-declared probe postings", () => {
  const probeSummary =
    "Probe job description with more than one hundred characters to satisfy " +
    "validation on the crypto jobs create endpoint for authorized testing only no hiring occurs";
  assert.ok(isNonJob(job({ id: "cryptojobs:dwpa-x-at-dwpa-probe-company-1", summary: probeSummary })));
  assert.ok(
    isNonJob(
      job({
        title: "BCI IDOR Probe Job",
        company: "OpenSea",
        summary: "Authorized security assessment probe posting created by the BCI lane",
      }),
    ),
  );
  assert.ok(isNonJob(job({ title: "DWPA REPLAY AMOUNTZERO", company: "DWPA Replay Company" })));
  assert.ok(isNonJob(job({ id: "cryptojobs:bci-price-probe-4-at-bci-probe-company-9" })));
  assert.ok(isNonJob(job({ title: "BCI Price Probe 7" })));
});

test("isNonJob catches HN seeker posts", () => {
  assert.ok(
    isNonJob(
      job({
        id: "hnhiring:abc",
        source: "hnhiring",
        title: "Location: X Remote: Yes Willing to relocate: yes Technologies: TypeScript",
        company: "Location: X Willing to relocate: yes",
      }),
    ),
  );
});

test("isNonJob leaves genuine jobs alone", () => {
  assert.ok(!isNonJob(job({ title: "QA / Test Engineer", company: "Acme" })));
  assert.ok(!isNonJob(job({ title: "Probe Engineer (semiconductor)", company: "ChipCo" })));
  assert.ok(!isNonJob(job({ title: "Penetration Tester", company: "SecureCo" })));
  // A pentest JD can legitimately mention authorized security testing.
  assert.ok(
    !isNonJob(job({ summary: "You will conduct authorized security testing of client systems and report findings." })),
  );
  assert.ok(!isNonJob(job({ title: "Replay Systems Engineer", company: "Replay.io" })));
});
