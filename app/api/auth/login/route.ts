import { randomBytes } from "node:crypto";
import { originOf } from "../../../../lib/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const origin = originOf(request);
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) return Response.redirect(origin + "/");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", id);
  url.searchParams.set("redirect_uri", origin + "/api/auth/callback");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  // CSRF nonce: bound to a short-lived HttpOnly cookie the callback verifies.
  // Without this, an attacker could feed a victim a callback URL carrying the
  // attacker's own auth code and log the victim into the attacker's account.
  const nonce = randomBytes(16).toString("base64url");
  const next = new URL(request.url).searchParams.get("next");
  url.searchParams.set("state", `${nonce}.${next && next.startsWith("/") && !next.startsWith("//") ? next : "/"}`);
  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      "Set-Cookie": `atlas_oauth=${nonce}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${origin.startsWith("https:") ? "; Secure" : ""}`,
    },
  });
}
