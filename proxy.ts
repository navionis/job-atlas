import { NextRequest, NextResponse } from "next/server";
async function valid(value: string, secret: string) {
  const [b64email, exp, sig] = value.split(".");
  if (!secret || !b64email || !exp || !sig || Number(exp) < Date.now()) return false;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
      "sign",
    ]);
    const out = await crypto.subtle.sign("HMAC", key, enc.encode(`${b64email}.${exp}`));
    const expected = btoa(String.fromCharCode(...new Uint8Array(out)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    // Edge runtime lacks node:crypto — constant-time compare by hand.
    if (expected.length !== sig.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}
// Guests land on public pages, not a login wall — only account surfaces
// (profile, admin) bounce to /login. Crawler-facing routes (OG image, icon)
// are public too.
const isPublic = (p: string) =>
  p === "/" ||
  p === "/login" ||
  p === "/privacy" ||
  p === "/opengraph-image" ||
  p === "/icon" ||
  p === "/apple-icon" ||
  p === "/jobs" ||
  p === "/api/jobs" ||
  p === "/api/events" ||
  p === "/api/health" ||
  p.startsWith("/jobs/") ||
  p.startsWith("/sources") ||
  p.startsWith("/api/auth/");
function csp(nonce: string) {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    // strict-dynamic trusts children loaded by nonce'd scripts (the GIS client
    // is injected at runtime). https: + 'unsafe-inline' are ignored by modern
    // browsers and only serve as fallbacks for ones without strict-dynamic.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com${dev ? " ws: wss:" : ""}`,
    "frame-src https://accounts.google.com",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
// The edge runtime can't import lib/auth (node:crypto, next/headers), so the
// same origin-vs-host rule is spelled out again here — it must stay identical.
const crossOrigin = (req: NextRequest) => {
  const o = req.headers.get("origin");
  if (!o) return false; // non-browser clients send no Origin — same-origin
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  try {
    return !host || new URL(o).host !== host;
  } catch {
    return true;
  }
};
export default async function proxy(req: NextRequest) {
  const nonce = crypto.randomUUID();
  const path = req.nextUrl.pathname;
  // Outer CSRF wall: reject cross-origin mutations before any route runs.
  // withUser/withOrigin enforce the same rule inside the handlers; this
  // catches the path someone forgets to wrap.
  if (path.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(req.method) && crossOrigin(req))
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  let res: NextResponse;
  const cookie = req.cookies.get("atlas_session")?.value;
  const authed = !process.env.GOOGLE_CLIENT_ID || (!!cookie && (await valid(cookie, process.env.AUTH_SECRET || "")));
  if (!authed && !isPublic(path)) {
    res = path.startsWith("/api/")
      ? NextResponse.json({ error: "Sign in required" }, { status: 401 })
      : NextResponse.redirect(new URL("/login?next=" + encodeURIComponent(path + req.nextUrl.search), req.url));
  } else {
    // Forward the nonce to server components via the request headers — they
    // read it through next/headers and stamp it on inline scripts.
    const reqHeaders = new Headers(req.headers);
    reqHeaders.set("x-nonce", nonce);
    res = NextResponse.next({ request: { headers: reqHeaders } });
  }
  if (!path.startsWith("/api/")) res.headers.set("Content-Security-Policy", csp(nonce));
  return res;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
