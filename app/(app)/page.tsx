import { cookies } from "next/headers";
import { verifySessionValue } from "../../lib/auth";
import { snapshot } from "../../lib/feeds";
import DashboardClient from "./dashboard-client";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Dashboard",
  description: "Your job discovery command center — live feeds, pipeline stats, and coverage at a glance.",
  robots: { index: false, follow: false },
};
export default async function Home() {
  const store = await cookies();
  const email = verifySessionValue(store.get("atlas_session")?.value)?.email || "";
  const initial = await snapshot(email).catch(() => ({
    jobs: [],
    sources: [],
    statuses: {},
    updatedAt: 0,
  }));
  return <DashboardClient initial={initial} />;
}
