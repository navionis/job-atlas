import { ensureAdmin } from "../../../../lib/feeds";
import { sessionCookieHeader } from "../../../../lib/auth";
import { originOf } from "../login/route";

function safeNext(v: string | null): string {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/";
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const url = new URL(request.url),
    origin = originOf(request);
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    console.error("[auth] AUTH_SECRET is not set — refusing to issue sessions");
    return Response.redirect(origin + "/login?error=config");
  }
  const code = url.searchParams.get("code");
  if (!code) {
    console.error("[auth] callback without code:", url.search);
    return Response.redirect(origin + "/login?error=1");
  }
  try {
    const t = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: origin + "/api/auth/callback",
        grant_type: "authorization_code",
      }),
    });
    if (!t.ok) {
      console.error("[auth] token exchange failed:", t.status, await t.text());
      return Response.redirect(origin + "/login?error=token");
    }
    const { id_token } = await t.json();
    const payload = JSON.parse(Buffer.from(String(id_token).split(".")[1], "base64url").toString());
    const email = String(payload.email || "").toLowerCase();
    if (!payload.email_verified || !email) return Response.redirect(origin + "/login?error=denied");
    await ensureAdmin(email);
    const cookie = sessionCookieHeader(
      { email, name: String(payload.name || ""), picture: String(payload.picture || "") },
      origin.startsWith("https:"),
    );
    if (!cookie) return Response.redirect(origin + "/login?error=config");
    return new Response(null, {
      status: 302,
      headers: {
        Location: origin + safeNext(url.searchParams.get("state")),
        "Set-Cookie": cookie,
      },
    });
  } catch (e) {
    console.error("[auth] callback failed:", e);
    return Response.redirect(origin + "/login?error=1");
  }
}
