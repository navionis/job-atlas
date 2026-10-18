import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionValue } from "../../../../lib/auth";
import { snapshot } from "../../../../lib/feeds";
import { getProfile } from "../../../../lib/profiles";
import SourcesClient from "./sources-client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin — Sources",
  description: "Feed catalog, publish limits, refresh policy, and per-source controls.",
  robots: { index: false, follow: false },
};

export default async function AdminSourcesPage() {
  const me = verifySessionValue((await cookies()).get("atlas_session")?.value);
  if (!me) redirect("/login");
  const [snap, prof] = await Promise.all([
    snapshot(me.email).catch(() => ({ jobs: [], sources: [], statuses: {}, updatedAt: 0 })),
    getProfile(me.email).catch(() => null),
  ]);
  return <SourcesClient initial={snap} sourceRank={prof?.sourceRank || {}} />;
}
