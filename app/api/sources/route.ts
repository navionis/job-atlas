import { getSession } from "../../../lib/auth";
import { setSourceDisabled } from "../../../lib/feeds";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const me = getSession(request);
  if (!me) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const { id, disabled } = await request.json();
    if (typeof id !== "string" || !id || typeof disabled !== "boolean")
      return Response.json({ error: "Invalid source update" }, { status: 400 });
    await setSourceDisabled(id, disabled);
    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error && e.message === "Unknown source" ? "Unknown source" : "Could not update source";
    return Response.json({ error: msg }, { status: 400 });
  }
}
