import { getSession } from "../../../lib/auth";
import { getProfile, saveProfile, effectiveKeywords, extractKeywords } from "../../../lib/profiles";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const norm = (v: any) =>
  [
    ...new Set(
      (Array.isArray(v) ? v : [])
        .map((x) => String(x).toLowerCase().trim())
        .filter((x) => x.length > 1 && x.length < 60),
    ),
  ].slice(0, 60);
export async function GET(request: Request) {
  const me = getSession(request);
  if (!me) return Response.json({ error: "Sign in required" }, { status: 401 });
  const p = await getProfile(me.email);
  return Response.json(
    {
      email: me.email,
      name: me.name,
      picture: me.picture,
      keywords: effectiveKeywords(p),
      manual: p.keywords,
      excluded: p.excluded,
      sourceRank: p.sourceRank || {},
      resumes: (p.resumes || []).map(({ text, ...r }) => ({ ...r, chars: text.length })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function PUT(request: Request) {
  const me = getSession(request);
  if (!me) return Response.json({ error: "Sign in required" }, { status: 401 });
  let body: any = {};
  try {
    body = await request.json();
  } catch {}
  const p = await getProfile(me.email);
  if ("keywords" in body) p.keywords = norm(body.keywords);
  if ("excluded" in body) p.excluded = norm(body.excluded);
  if ("resumeKeywords" in body && body.resumeKeywords && typeof body.resumeKeywords === "object")
    for (const [id, kws] of Object.entries(body.resumeKeywords)) {
      const r = (p.resumes || []).find((x) => x.id === id);
      if (r) r.keywords = norm(kws);
    }
  if ("resumeExtract" in body && body.resumeExtract && typeof body.resumeExtract === "object")
    for (const id of Object.keys(body.resumeExtract)) {
      const r = (p.resumes || []).find((x) => x.id === id);
      if (r) r.keywords = norm([...r.keywords, ...extractKeywords(r.text || "", 120)]);
    }
  if ("sourceRank" in body && body.sourceRank && typeof body.sourceRank === "object")
    p.sourceRank = Object.fromEntries(
      Object.entries(body.sourceRank)
        .map(([k, v]) => [k, Math.min(5, Math.max(1, Math.round(Number(v) || 3)))] as [string, number])
        .slice(0, 50),
    );
  await saveProfile(me.email, p);
  return Response.json({
    keywords: effectiveKeywords(p),
    manual: p.keywords,
    excluded: p.excluded,
    sourceRank: p.sourceRank || {},
    resumes: (p.resumes || []).map(({ text, ...r }) => ({ ...r, chars: text.length })),
  });
}
