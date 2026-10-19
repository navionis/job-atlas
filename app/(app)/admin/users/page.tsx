import { redirect } from "next/navigation";
import { currentSession } from "../../../../lib/auth";
import { listUsers } from "../../../../lib/feeds";
import UsersClient from "./users-client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin — Users",
  description: "Signed-in accounts and admin seat management.",
  robots: { index: false, follow: false },
};

export default async function AdminUsersPage() {
  const me = await currentSession();
  if (!me) redirect("/login");
  const users = await listUsers().catch(() => []);
  return <UsersClient users={users} me={me.email} />;
}
