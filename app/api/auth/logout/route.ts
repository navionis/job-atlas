export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const clear = "atlas_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
// POST only — a GET logout is trivially CSRF-able (cross-site top-level
// navigations still carry SameSite=Lax cookies).
export async function POST() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clear } });
}
export async function GET() {
  return Response.json({ error: "Use POST" }, { status: 405 });
}
