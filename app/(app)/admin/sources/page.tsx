import { redirect } from "next/navigation";
import { currentSession } from "../../../../lib/auth";
import { loadSnapshot } from "../../../../lib/feeds";
import { getProfile } from "../../../../lib/profiles";
import SourcesClient from "./sources-client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin — Sources",
  description: "Feed catalog, publish limits, refresh policy, and per-source controls.",
  robots: { index: false, follow: false },
};

export default async function AdminSourcesPage() {
  const me = await currentSession();
  if (!me) redirect("/login");
  const [snap, prof] = await Promise.all([loadSnapshot(me.email), getProfile(me.email).catch(() => null)]);
  return <SourcesClient initial={snap} sourceRank={prof?.sourceRank || {}} />;
}
