import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionValue } from "../../../lib/auth";
import { getProfile, effectiveKeywords } from "../../../lib/profiles";
import ProfileClient from "./profile-client";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Profile",
  description: "Manage resumes, keyword extraction, source ranking, and your saved Discover preferences.",
  robots: { index: false, follow: false },
};
export default async function ProfilePage() {
  const store = await cookies();
  const me = verifySessionValue(store.get("atlas_session")?.value);
  if (!me) redirect("/login");
  const p = await getProfile(me.email);
  return (
    <ProfileClient
      me={me}
      initial={{
        keywords: effectiveKeywords(p),
        manual: p.keywords,
        excluded: p.excluded,
        sourceRank: p.sourceRank || {},
        filters: p.filters || {},
        resumes: (p.resumes || []).map(({ text, ...r }) => ({ ...r, chars: text.length })),
      }}
    />
  );
}
