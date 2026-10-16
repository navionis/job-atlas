import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionValue } from "../../../lib/auth";
import { snapshot } from "../../../lib/feeds";
import { getProfile } from "../../../lib/profiles";
import MatchesClient from "./matches-client";

export const dynamic = "force-dynamic";
export default async function MatchesPage() {
  const token = (await cookies()).get("atlas_session")?.value;
  const me = await verifySessionValue(token);
  if (!me) redirect("/login");
  const [snap, prof] = await Promise.all([snapshot(me.email), getProfile(me.email)]);
  return (
    <MatchesClient
      initial={snap}
      profile={{
        resumes: (prof.resumes || []).map((r) => ({ id: r.id, name: r.name, keywords: r.keywords })),
        manual: prof.keywords || [],
        excluded: prof.excluded || [],
        sourceRank: prof.sourceRank || {},
      }}
    />
  );
}
