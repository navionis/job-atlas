import { ensureAdmin } from "../../../../lib/feeds";
import { sessionCookieHeader } from "../../../../lib/auth";
import { originOf } from "../login/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Google One Tap / GIS credential sign-in. The browser prompt returns a signed
// ID token; we verify it with Google and issue the same atlas_session cookie
// the OAuth callback does.
export async function POST(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return Response.json({ error: "Not configured" }, { status: 400 });
  // Same-site requests only — this endpoint sets a session cookie, and
  // SameSite=Lax does not stop a cookie being *set* by a cross-site POST
  // (login CSRF). Browsers always send Origin on cross-site POSTs.
  const o = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  try {
    if (o && new URL(o).host !== host) return Response.json({ error: "Bad origin" }, { status: 403 });
  } catch {
    return Response.json({ error: "Bad origin" }, { status: 403 });
  }
  let credential = "";
  try {
    const body = await request.json();
    credential = String(body?.credential || "");
  } catch {
    /* fallthrough */
  }
  // Validate compact-JWT shape before paying for an upstream tokeninfo call.
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(credential) || credential.length > 8192)
    return Response.json({ error: "Missing credential" }, { status: 400 });
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!r.ok) return Response.json({ error: "Invalid credential" }, { status: 401 });
    const p = await r.json();
    if (p.aud !== clientId) return Response.json({ error: "Wrong audience" }, { status: 401 });
    const email = String(p.email || "").toLowerCase();
    if (p.email_verified !== "true" || !email) return Response.json({ error: "Denied" }, { status: 403 });
    await ensureAdmin(email);
    const origin = originOf(request);
    const cookie = sessionCookieHeader(
      { email, name: String(p.name || ""), picture: String(p.picture || "") },
      origin.startsWith("https:"),
    );
    if (!cookie) return Response.json({ error: "Not configured" }, { status: 500 });
    return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie } });
  } catch {
    return Response.json({ error: "Sign-in failed" }, { status: 500 });
  }
}
