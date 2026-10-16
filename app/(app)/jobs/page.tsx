import { cookies } from "next/headers";
import { snapshot } from "../../../lib/feeds";
import { verifySessionValue } from "../../../lib/auth";
import { getProfile, effectiveKeywords } from "../../../lib/profiles";
import JobsClient from "./jobs-client";
export const dynamic = "force-dynamic";
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
    keywords: p ? effectiveKeywords(p) : [],
    sourceRank: p?.sourceRank || {},
  };
  return <JobsClient initial={initial} meta={meta} />;
}
