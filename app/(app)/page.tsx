import { currentSession } from "../../lib/auth";
import { loadSnapshot } from "../../lib/feeds";
import DashboardClient from "./dashboard-client";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Dashboard",
  description: "Your job discovery command center — live feeds, pipeline stats, and coverage at a glance.",
  robots: { index: false, follow: false },
};
export default async function Home() {
  const email = (await currentSession())?.email || "";
  const initial = await loadSnapshot(email);
  return <DashboardClient initial={initial} />;
}
