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
const FILTER_KEYS: Record<string, "s" | "b"> = {
  country: "s",
  group: "s",
  mode: "s",
  source: "s",
  sched: "s",
  statusFilter: "s",
  remoteTo: "s",
  query: "s",
  remote: "s",
  unknown: "b",
};
const normFilters = (v: any) => {
  const out: Record<string, string | boolean> = {};
  if (v && typeof v === "object")
    for (const [k, t] of Object.entries(FILTER_KEYS))
      if (k in v) out[k] = t === "b" ? !!v[k] : String(v[k] ?? "").slice(0, 120);
  return out;
};
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
      filters: p.filters || {},
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
  if ("filters" in body) p.filters = normFilters(body.filters);
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
    filters: p.filters || {},
    resumes: (p.resumes || []).map(({ text, ...r }) => ({ ...r, chars: text.length })),
  });
}
