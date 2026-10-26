import { originOf, sessionCookieHeader } from "../../../../../lib/auth";
import { consumeToken } from "../../../../../lib/email-tokens";
import { ensureAdmin } from "../../../../../lib/feeds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = originOf(request);
  const token = new URL(request.url).searchParams.get("token") || "";
  const email = await consumeToken(token);
  if (!email) return Response.redirect(origin + "/login?error=link");
  await ensureAdmin(email);
  const cookie = sessionCookieHeader({ email, name: email.split("@")[0], picture: "" }, origin.startsWith("https:"));
  if (!cookie) {
    console.error("[auth] AUTH_SECRET is not set — refusing to issue sessions");
    return Response.redirect(origin + "/login?error=config");
  }
  const headers = new Headers({ Location: origin + "/" });
  headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}
