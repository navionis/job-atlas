import { withAdmin } from "../../../lib/guard";
import { setAdmin, listUsers } from "../../../lib/feeds";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = withAdmin(async (_me, request) => {
  try {
    const { email, admin } = await request.json();
    if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || typeof admin !== "boolean")
      return Response.json({ error: "Invalid admin update" }, { status: 400 });
    await setAdmin(email, admin);
    return Response.json({ ok: true, users: await listUsers() });
  } catch {
    return Response.json({ error: "Could not update admins" }, { status: 500 });
  }
});
