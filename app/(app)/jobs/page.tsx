import { Suspense } from "react";
import { loadSnapshot } from "../../../lib/feeds";
import { currentSession } from "../../../lib/auth";
import { jobsMeta } from "../../../lib/profiles";
import JobsClient from "./jobs-client";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Discover jobs",
  description: "Browse and rank aggregated job listings by region, eligibility, source, schedule, and pipeline stage.",
  alternates: { canonical: "/jobs" },
  robots: { index: true, follow: true },
};
export default async function JobsPage() {
  const me = await currentSession();
  const initial = await loadSnapshot(me?.email || "");
  const meta = await jobsMeta(me);
  return (
    <Suspense fallback={null}>
      <JobsClient initial={initial} meta={meta} />
    </Suspense>
  );
}
