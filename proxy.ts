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
export default async function proxy(req: NextRequest) {
  if (!process.env.GOOGLE_CLIENT_ID) return NextResponse.next();
  const cookie = req.cookies.get("atlas_session")?.value;
  if (cookie && (await valid(cookie, process.env.AUTH_SECRET || ""))) return NextResponse.next();
  if (req.nextUrl.pathname === "/") return NextResponse.next(); // dashboard is public
  if (req.nextUrl.pathname.startsWith("/api/"))
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const url = req.nextUrl.clone();
  // Guests land on public pages, not a login wall — only account surfaces
  // (profile, admin) bounce to /login.
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}
export const config = {
  matcher: ["/((?!api/auth|api/health|api/jobs|api/events|login|jobs|sources|_next|.*\\..*).*)"],
};
