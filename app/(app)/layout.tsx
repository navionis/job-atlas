import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionValue } from "../../lib/auth";
import { SiteHeader, SiteFooter, ScrollTop } from "../../components/site-chrome";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const me = verifySessionValue(store.get("atlas_session")?.value);
  if (!me) redirect("/login");
  return (
    <>
      <SiteHeader me={me} />
      <main>{children}</main>
      <SiteFooter />
      <ScrollTop />
    </>
  );
}
