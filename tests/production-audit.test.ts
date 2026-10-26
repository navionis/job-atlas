import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "../lib/auth";
import { isNonJob } from "../lib/feeds";
import { buildMatchPrompt, buildResumePrompt, parseKeywords, parseVerdicts } from "../lib/devin";
import { relTime } from "../lib/time";
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

// ---- Devin AI match helpers ----------------------------------------------

test("buildMatchPrompt embeds profile + slim jobs and forbids tool use", () => {
  const p = buildMatchPrompt({ keywords: ["typescript"], excluded: ["php"], filters: { country: "gb" } }, [
    job({ id: "a:1", summary: "x".repeat(900) }),
  ]);
  assert.ok(p.includes('"typescript"'));
  assert.ok(p.includes('"a:1"'));
  assert.ok(/Do not clone repositories/.test(p));
  // Summaries are capped for prompt size.
  assert.ok(!p.includes("x".repeat(500)));
});

test("parseVerdicts whitelists ids, clamps scores, tolerates junk", () => {
  const valid = new Set(["a:1", "a:2"]);
  const out = parseVerdicts(
    {
      matches: [
        { id: "a:1", score: 142.4, reason: "strong skill overlap" },
        { id: "evil:9", score: 99, reason: "hallucinated" },
        { id: "a:2", score: -3 },
        { score: 50 },
      ],
    },
    valid,
  );
  assert.deepEqual(
    out.map((m) => [m.id, m.score]),
    [
      ["a:1", 100],
      ["a:2", 0],
    ],
  );
  assert.equal(out[0].reason, "strong skill overlap");
  assert.deepEqual(parseVerdicts(null, valid), []);
  assert.deepEqual(parseVerdicts({ matches: "nope" }, valid), []);
});

test("buildResumePrompt embeds capped resume text and forbids tool use", () => {
  const p = buildResumePrompt("cv.pdf", "text " + "x".repeat(30000));
  assert.ok(p.includes("cv.pdf"));
  assert.ok(/Do not clone repositories/.test(p));
  assert.ok(p.length < 30000);
});

test("parseKeywords normalizes, dedupes, caps, tolerates junk", () => {
  const out = parseKeywords({
    keywords: [" TypeScript ", "TYPESCRIPT", "react", "", "x", "a".repeat(70), 42, null, "GraphQL"],
    summary: "Full-stack engineer",
  });
  assert.deepEqual(out.keywords, ["typescript", "react", "42", "graphql"]);
  assert.equal(out.summary, "Full-stack engineer");
  assert.deepEqual(parseKeywords(null).keywords, []);
  assert.deepEqual(parseKeywords({ keywords: "nope" }).keywords, []);
  assert.equal(parseKeywords({ keywords: Array(60).fill("dup") }).keywords.length, 1); // dedupe before cap
  assert.equal(parseKeywords({ keywords: Array.from({ length: 60 }, (_, i) => `kw${i}`) }).keywords.length, 40);
});

// ---- Relative timestamps ---------------------------------------------------

test("relTime stays relative at every age", () => {
  const now = Date.parse("2026-10-26T12:00:00Z");
  assert.equal(relTime(now - 30000, now), "just now");
  assert.equal(relTime(now - 45 * 60000, now), "45m ago");
  assert.equal(relTime(now - 5 * 3600000, now), "5h ago");
  assert.equal(relTime(now - 3 * 86400000, now), "3d ago");
  assert.equal(relTime(now - 20 * 86400000, now), "2w ago");
  assert.equal(relTime(now - 300 * 86400000, now), "10mo ago");
  assert.equal(relTime(now - 800 * 86400000, now), "2y ago");
  assert.equal(relTime("not-a-date", now), "Date unavailable");
});
