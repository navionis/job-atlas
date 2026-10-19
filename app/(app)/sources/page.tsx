import { loadSnapshot, isAdminUser } from "../../../lib/feeds";
import { currentSession } from "../../../lib/auth";
import SourcesClient from "./sources-client";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Sources",
  description: "Live status of every connected job feed — health, listing counts, and refresh schedule.",
  alternates: { canonical: "/sources" },
  robots: { index: true, follow: true },
};
export default async function SourcesPage() {
  const me = await currentSession();
  const initial = await loadSnapshot(me?.email || "");
  const canAdmin = me ? await isAdminUser(me.email).catch(() => false) : false;
  return <SourcesClient initial={initial} canAdmin={canAdmin} />;
}
