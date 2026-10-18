import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionValue } from "../../../lib/auth";
import { isAdminUser } from "../../../lib/feeds";
import { FadeIn } from "../../../components/motion";
import { ShieldCheck } from "lucide-react";
import AdminTabs from "./admin-tabs";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = verifySessionValue((await cookies()).get("atlas_session")?.value);
  if (!me) redirect("/login");
  if (!(await isAdminUser(me.email))) redirect("/");
  return (
    <FadeIn className="pf-wrap">
      <div className="section-title">
        <div>
          <h2>
            <ShieldCheck size={17} /> Admin
          </h2>
          <p>Feed catalog, publish limits, refresh policy, and account management.</p>
        </div>
      </div>
      <AdminTabs />
      {children}
    </FadeIn>
  );
}
