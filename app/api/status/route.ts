import { withUser } from "../../../lib/guard";
import { setJobStatus } from "../../../lib/feeds";
import type { JobStatus } from "../../../lib/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = withUser(async (me, request) => {
  try {
    const { id, status } = await request.json();
    if (typeof id !== "string" || !id || !["listed", "applied", "cancelled", "ignored"].includes(status))
      return Response.json({ error: "Invalid status update" }, { status: 400 });
    await setJobStatus(me.email, id, status as JobStatus);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not save status" }, { status: 500 });
  }
});
