import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionValue } from "../../../lib/auth";
import { snapshot, isAdminUser, listUsers } from "../../../lib/feeds";
import { getProfile } from "../../../lib/profiles";
import AdminClient from "./admin-client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin",
  description: "Feed catalog, publish limits, refresh policy, and admin seat management.",
  robots: { index: false, follow: false },
};
export default async function AdminPage() {
  const token = (await cookies()).get("atlas_session")?.value;
  const me = await verifySessionValue(token);
  if (!me) redirect("/login");
  if (!(await isAdminUser(me.email))) redirect("/");
  const [snap, prof, users] = await Promise.all([snapshot(me.email), getProfile(me.email), listUsers()]);
  return <AdminClient initial={snap} sourceRank={prof.sourceRank || {}} users={users} me={me.email} />;
}
