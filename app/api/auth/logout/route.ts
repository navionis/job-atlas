import { originOf } from "../login/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: originOf(request) + "/login",
      "Set-Cookie": "atlas_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
    },
  });
}
