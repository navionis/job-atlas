import { createHmac } from "node:crypto";
import { ensureAdmin } from "../../../../lib/feeds";
import { originOf } from "../login/route";
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
    const exp = Date.now() + 7 * 24 * 3600 * 1000;
    const profile = { e: email, n: String(payload.name || ""), p: String(payload.picture || "") };
    const data = `${Buffer.from(JSON.stringify(profile), "utf8").toString("base64url")}.${exp}`;
    const sig = createHmac("sha256", secret).update(data).digest("base64url");
    return new Response(null, {
      status: 302,
      headers: {
        Location: origin + "/",
        "Set-Cookie": `atlas_session=${data}.${sig}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}${origin.startsWith("https:") ? "; Secure" : ""}`,
      },
    });
  } catch (e) {
    console.error("[auth] callback failed:", e);
    return Response.redirect(origin + "/login?error=1");
  }
}
