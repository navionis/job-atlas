import { dbPing, pgEnabled } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = pgEnabled() ? await dbPing() : null;
  const ok = db !== false;
  return Response.json(
    { ok, db: db === null ? "file" : db ? "up" : "down", uptime: Math.round(process.uptime()) },
    { status: ok ? 200 : 503 },
  );
}
