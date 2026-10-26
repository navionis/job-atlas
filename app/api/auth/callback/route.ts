import { ensureAdmin } from "../../../../lib/feeds";
import { cookieValue, sessionCookieHeader } from "../../../../lib/auth";
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
  // Login-CSRF check: the state nonce must match the cookie /api/auth/login set.
  const stateParam = url.searchParams.get("state") || "";
  const sep = stateParam.indexOf(".");
  const stateNonce = sep > 0 ? stateParam.slice(0, sep) : "";
  const next = sep > 0 ? stateParam.slice(sep + 1) : "/";
  if (!stateNonce || stateNonce !== cookieValue(request, "atlas_oauth"))
    return Response.redirect(origin + "/login?error=state");
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
    // The token arrives from Google over server-side TLS in exchange for our
    // secret, but verify audience/issuer/expiry anyway — defence in depth.
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const audOk = Array.isArray(payload.aud) ? payload.aud.includes(clientId) : payload.aud === clientId;
    const issOk = payload.iss === "accounts.google.com" || payload.iss === "https://accounts.google.com";
    if (!audOk || !issOk || Number(payload.exp) * 1000 < Date.now())
      return Response.redirect(origin + "/login?error=denied");
    const email = String(payload.email || "").toLowerCase();
    if (!payload.email_verified || !email) return Response.redirect(origin + "/login?error=denied");
    await ensureAdmin(email);
    const cookie = sessionCookieHeader(
      { email, name: String(payload.name || ""), picture: String(payload.picture || "") },
      origin.startsWith("https:"),
    );
    if (!cookie) return Response.redirect(origin + "/login?error=config");
    const headers = new Headers({ Location: origin + safeNext(next) });
    headers.append("Set-Cookie", cookie);
    // Single-use: burn the state cookie on the way out.
    headers.append(
      "Set-Cookie",
      `atlas_oauth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${origin.startsWith("https:") ? "; Secure" : ""}`,
    );
    return new Response(null, { status: 302, headers });
  } catch (e) {
    console.error("[auth] callback failed:", e);
    return Response.redirect(origin + "/login?error=1");
  }
}
