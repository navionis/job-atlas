import { withSession } from "../../../../lib/guard";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = withSession(async (me) =>
  Response.json(me, { headers: { "Cache-Control": "no-store" } }),
);
