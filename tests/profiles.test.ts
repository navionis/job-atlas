import { test } from "node:test";
import assert from "node:assert/strict";
import { extractKeywords, effectiveKeywords, emptyProfile } from "../lib/profiles";

test("extractKeywords finds dictionary skills and drops stopwords", () => {
  const kw = extractKeywords("Built typescript react services with docker and kubernetes. Experience with agile teams.");
  assert(kw.includes("typescript"));
  assert(kw.includes("react"));
  assert(kw.includes("docker"));
  assert(!kw.includes("experience"));
  assert(!kw.includes("with"));
});

test("extractKeywords catches multi-word skills and respects max", () => {
  const kw = extractKeywords("Deployed on Google Cloud and Google Cloud again.");
  assert(kw.includes("google cloud"));
  assert(extractKeywords("typescript ".repeat(200), 3).length <= 3);
  assert.deepEqual(extractKeywords(""), []);
});

test("effectiveKeywords merges manual + resume, dedupes, drops excluded, caps 40", () => {
  const p = emptyProfile();
  p.keywords = ["typescript", "React"];
  p.excluded = ["react"];
  p.resumes = [{ id: "r1", name: "r", size: 1, uploadedAt: 1, text: "", keywords: ["typescript", "go"] }];
  const eff = effectiveKeywords(p);
  assert(eff.includes("typescript"));
  assert(eff.includes("go"));
  assert(!eff.some((k) => k.toLowerCase() === "react"));
  assert.equal(eff.length, new Set(eff.map((k) => k.toLowerCase())).size);
  p.keywords = Array.from({ length: 50 }, (_, i) => `kw${i}`);
  assert(effectiveKeywords(p).length <= 40);
});
