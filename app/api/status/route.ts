import { withUser } from "../../../lib/guard";
import { dbGetJob, pgEnabled } from "../../../lib/db";
import { isNonJob, setJobStatus, snapshot } from "../../../lib/feeds";
import type { JobStatus } from "../../../lib/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = withUser(async (me, request) => {
  try {
    const { id, status } = await request.json();
    if (typeof id !== "string" || !id || !["listed", "applied", "cancelled", "ignored"].includes(status))
      return Response.json({ error: "Invalid status update" }, { status: 400 });
    // Probe/test records must not be trackable. A missing record still writes —
    // statuses on listings that aged out of the live snapshot remain editable.
    const snap = await snapshot("").catch(() => null);
    const job = snap?.jobs.find((j) => j.id === id) || (pgEnabled() ? await dbGetJob(id) : null);
    if (job && isNonJob(job)) return Response.json({ error: "Job not found" }, { status: 404 });
    await setJobStatus(me.email, id, status as JobStatus);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not save status" }, { status: 500 });
  }
});
