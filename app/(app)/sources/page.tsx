import { cookies } from "next/headers";
import { snapshot, isAdminUser } from "../../../lib/feeds";
import { verifySessionValue } from "../../../lib/auth";
import SourcesClient from "./sources-client";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Sources",
  description: "Live status of every connected job feed — health, listing counts, and refresh schedule.",
  robots: { index: true, follow: true },
};
export default async function SourcesPage() {
  const me = verifySessionValue((await cookies()).get("atlas_session")?.value);
  const initial = await snapshot(me?.email || "").catch(() => ({
    jobs: [],
    sources: [],
    statuses: {},
    updatedAt: 0,
  }));
  const canAdmin = me ? await isAdminUser(me.email).catch(() => false) : false;
  return <SourcesClient initial={initial} canAdmin={canAdmin} />;
}
