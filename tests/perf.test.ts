import { test } from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { parseScope } from "../lib/geo";
import { rankJobs } from "../lib/match";
import { extractKeywords } from "../lib/profiles";
import type { Job } from "../lib/types";

const LOCATIONS = [
  "Remote - Worldwide",
  "New York, NY",
  "Berlin, Germany",
  "Addis Ababa, Ethiopia",
  "Remote (US only)",
  "London, UK",
  "EMEA",
  "Remote - Europe",
  "San Francisco, CA / Remote",
  "Anywhere",
];
const KEYWORDS = ["typescript", "react", "node.js", "aws", "docker", "kubernetes", "postgres", "graphql"];

const scope = () => ({
  countries: [] as string[],
  groups: [] as string[],
  worldwide: false,
  unknown: true,
  raw: "",
  excluded: [] as string[],
  uncertain: false,
});
const job = (i: number): Job => ({
  id: `j${i}`,
  title: `${i % 3 ? "Senior" : "Staff"} ${["React", "Backend", "Platform"][i % 3]} Engineer`,
  company: `Co${i % 50}`,
  url: `https://x/${i}`,
  source: `feed${i % 12}:x`,
  location: LOCATIONS[i % LOCATIONS.length],
  remote: i % 2 === 0,
  posted: "2026-10-01T00:00:00.000Z",
  tags: i % 4 === 0 ? ["typescript", "react"] : ["go"],
  scope: scope(),
  eligibility: scope(),
  summary: `We build ${i % 2 ? "node.js services on aws with docker" : "data pipelines"} — role ${i}.`,
});

const bench = (fn: () => void) => {
  const t = performance.now();
  fn();
  return performance.now() - t;
};

test("parseScope: 10k parses of varied locations stay under 500ms", () => {
  let parsed = 0;
  const ms = bench(() => {
    for (let i = 0; i < 10_000; i++) {
      const s = parseScope(LOCATIONS[i % LOCATIONS.length]);
      if (!s.unknown) parsed++;
    }
  });
  assert(parsed > 0);
  console.log(`  parseScope x10k: ${ms.toFixed(1)}ms`);
  assert(ms < 500, `parseScope too slow: ${ms.toFixed(1)}ms`);
});

test("parseScope cold-path (unique strings) stays under 2s for 5k", () => {
  const ms = bench(() => {
    for (let i = 0; i < 5_000; i++) parseScope(`City${i}, Region${i % 100}`);
  });
  console.log(`  parseScope unique x5k: ${ms.toFixed(1)}ms`);
  assert(ms < 2_000, `parseScope cold path too slow: ${ms.toFixed(1)}ms`);
});

test("rankJobs scores 2k jobs against 8 keywords under 300ms", () => {
  const jobs = Array.from({ length: 2_000 }, (_, i) => job(i));
  const ranked = rankJobs(jobs, KEYWORDS, ["php"], { feed0: 5 });
  assert(ranked.length > 0);
  const ms = bench(() => rankJobs(jobs, KEYWORDS, ["php"], {}));
  console.log(`  rankJobs x2000: ${ms.toFixed(1)}ms (${ranked.length} ranked)`);
  assert(ms < 300, `rankJobs too slow: ${ms.toFixed(1)}ms`);
});

test("extractKeywords on a 200KB resume under 200ms", () => {
  const big = "typescript react node.js docker kubernetes aws postgres graphql agile scrum ci/cd ".repeat(2_000);
  const ms = bench(() => extractKeywords(big));
  console.log(`  extractKeywords 200KB: ${ms.toFixed(1)}ms`);
  assert(ms < 200, `extractKeywords too slow: ${ms.toFixed(1)}ms`);
});
