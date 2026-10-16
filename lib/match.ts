import type { Job } from "./types";

export type JobMatch = {
  job: Job;
  score: number;
  hits: string[]; // matched keywords, strongest first
};

const W_TITLE = 3,
  W_TAGS = 2.5,
  W_SUMMARY = 1.5,
  W_META = 0.5,
  MIN_SCORE = 15;

/**
 * Score a job against a keyword set.
 * Weighted by where each keyword lands: title > tags > summary > company/meta.
 * Excluded terms in the job text drop it entirely (score 0).
 */
export function scoreJob(job: Job, keywords: string[], excluded: string[]): JobMatch | null {
  const title = job.title.toLowerCase();
  const tags = (job.tags || []).join(" ").toLowerCase();
  const summary = (job.summary || "").toLowerCase();
  const meta = `${job.company} ${job.location}`.toLowerCase();
  const hay = `${title} ${tags} ${summary}`;

  for (const ex of excluded || []) {
    const e = ex.toLowerCase().trim();
    if (e && hay.includes(e)) return null;
  }

  const weighted: { k: string; w: number }[] = [];
  for (const kw of keywords || []) {
    const k = kw.toLowerCase().trim();
    if (k.length < 2) continue;
    const w = title.includes(k)
      ? W_TITLE
      : tags.includes(k)
        ? W_TAGS
        : summary.includes(k)
          ? W_SUMMARY
          : meta.includes(k)
            ? W_META
            : 0;
    if (w) weighted.push({ k, w });
  }
  if (!weighted.length) return null;

  weighted.sort((a, b) => b.w - a.w);
  const raw = weighted.reduce((s, x) => s + x.w, 0);
  const score = Math.round((100 * raw) / (raw + 10)); // saturating curve
  return { job, score, hits: weighted.map((x) => x.k) };
}

/** Rank all jobs for a keyword set, applying the per-source rank multiplier. */
export function rankJobs(
  jobs: Job[],
  keywords: string[],
  excluded: string[],
  sourceRank: Record<string, number>,
): JobMatch[] {
  const out: JobMatch[] = [];
  for (const job of jobs) {
    const m = scoreJob(job, keywords, excluded);
    if (!m) continue;
    const rank = sourceRank[job.source.split(":")[0]] ?? 3;
    m.score = Math.min(100, Math.round(m.score * (0.7 + rank * 0.08)));
    if (m.score >= MIN_SCORE) out.push(m);
  }
  return out.sort((a, b) => b.score - a.score || b.job.posted.localeCompare(a.job.posted));
}
