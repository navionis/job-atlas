import { getSession } from "../../../lib/auth";
import { snapshot } from "../../../lib/feeds";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const me = getSession(request);
  if (!me) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    return Response.json(await snapshot(me.email), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      { error: "Feed storage unavailable. Check server DATA_DIR permissions and state file." },
      { status: 503 },
    );
  }
}
