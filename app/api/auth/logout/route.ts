import { withOrigin } from "../../../../lib/guard";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const clear = "atlas_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
// POST only — a GET logout is trivially CSRF-able (cross-site top-level
// navigations still carry SameSite=Lax cookies). Origin check too: a
// cross-site POST logout is a nuisance worth blocking while we're here.
export const POST = withOrigin(async () =>
  Response.json({ ok: true }, { headers: { "Set-Cookie": clear } }),
);
export async function GET() {
  return Response.json({ error: "Use POST" }, { status: 405 });
}
