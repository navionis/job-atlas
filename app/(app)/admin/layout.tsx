import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionValue } from "../../../lib/auth";
import { isAdminUser } from "../../../lib/feeds";
import { FadeIn } from "../../../components/motion";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = verifySessionValue((await cookies()).get("atlas_session")?.value);
  if (!me) redirect("/login");
  if (!(await isAdminUser(me.email))) redirect("/");
  return <FadeIn className="pf-wrap">{children}</FadeIn>;
}
