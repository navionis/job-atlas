import { Suspense } from "react";
import { cookies } from "next/headers";
import { snapshot } from "../../../lib/feeds";
import { verifySessionValue } from "../../../lib/auth";
import { getProfile, effectiveKeywords } from "../../../lib/profiles";
import JobsClient from "./jobs-client";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Discover jobs",
  description: "Browse and rank aggregated job listings by region, eligibility, source, schedule, and pipeline stage.",
  robots: { index: true, follow: true },
};
export default async function JobsPage() {
  const store = await cookies();
  const me = verifySessionValue(store.get("atlas_session")?.value);
  const initial = await snapshot(me?.email || "").catch(() => ({
    jobs: [],
    sources: [],
    statuses: {},
    updatedAt: 0,
  }));
  const p = me ? await getProfile(me.email).catch(() => null) : null;
  const meta = {
    guest: !me,
    keywords: p ? effectiveKeywords(p) : [],
    sourceRank: p?.sourceRank || {},
    filters: p?.filters || {},
    resumes: (p?.resumes || []).map((r) => ({ id: r.id, name: r.name, alias: r.alias, keywords: r.keywords })),
    manual: p?.keywords || [],
    excluded: p?.excluded || [],
  };
  return (
    <Suspense fallback={null}>
      <JobsClient initial={initial} meta={meta} />
    </Suspense>
  );
}
