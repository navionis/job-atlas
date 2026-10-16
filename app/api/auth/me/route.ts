import { getSession } from "../../../../lib/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const me = getSession(request);
  if (!me) return Response.json({ error: "Not signed in" }, { status: 401 });
  return Response.json(me, { headers: { "Cache-Control": "no-store" } });
}
