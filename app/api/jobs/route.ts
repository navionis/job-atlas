import { getSession } from "../../../lib/auth";
import { snapshot } from "../../../lib/feeds";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const me = getSession(request);
  try {
    // Guests get the shared feed with no per-user statuses.
    const data = await snapshot(me?.email || "");
    return Response.json({ ...data, serverAt: Date.now() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      { error: "Feed storage unavailable. Check server DATA_DIR permissions and state file." },
      { status: 503 },
    );
  }
}
