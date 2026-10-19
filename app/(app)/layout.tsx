import { cookies } from "next/headers";
import { verifySessionValue } from "../../lib/auth";
import { isAdminUser } from "../../lib/feeds";
import { SiteHeader, SiteFooter, ScrollTop } from "../../components/site-chrome";
import GoogleContinue from "../../components/google-continue";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const me = verifySessionValue(store.get("atlas_session")?.value);
  // Guests browse public pages (Discover, Sources) — account surfaces gate
  // themselves in their own page/layout (dashboard, profile, admin).
  return (
    <>
      <SiteHeader me={me} admin={me ? await isAdminUser(me.email) : false} />
      <div className="scroll-region">
        <main>{children}</main>
        <SiteFooter me={me} />
      </div>
      <ScrollTop />
      {!me && process.env.GOOGLE_CLIENT_ID ? <GoogleContinue clientId={process.env.GOOGLE_CLIENT_ID} /> : null}
    </>
  );
}
