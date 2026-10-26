import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
export type Session = { email: string; name: string; picture: string };
const SESSION_AGE = 7 * 24 * 3600 * 1000;
// Bump SESSION_EPOCH to invalidate every outstanding session at once, without
// rotating AUTH_SECRET. Lives inside the signed payload so the signature
// input (and the edge proxy's verifier) stays unchanged.
const epoch = () => process.env.SESSION_EPOCH || "1";
export function cookieValue(request: Request, name: string): string | null {
  const raw = (request.headers.get("cookie") || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(name + "="));
  return raw ? decodeURIComponent(raw.slice(name.length + 1)) : null;
}
export function sessionCookieHeader(s: Session, secure: boolean): string | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  const exp = Date.now() + SESSION_AGE;
  const data = `${Buffer.from(JSON.stringify({ e: s.email, n: s.name, p: s.picture, v: epoch() }), "utf8").toString("base64url")}.${exp}`;
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `atlas_session=${data}.${sig}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_AGE / 1000}${secure ? "; Secure" : ""}`;
}
export function getSession(request: Request): Session | null {
  return verifySessionValue(cookieValue(request, "atlas_session"));
}
/** Session from the current request's cookie store (server components/pages). */
export async function currentSession(): Promise<Session | null> {
  return verifySessionValue((await cookies()).get("atlas_session")?.value);
}
export const unauthorized = () => Response.json({ error: "Sign in required" }, { status: 401 });
export const forbidden = () => Response.json({ error: "Bad origin" }, { status: 403 });
/**
 * True when a mutating request comes from this deployment's own origin.
 * Browsers always send Origin on cross-site POSTs, so a missing header means
 * a non-browser client (curl, server-to-server) — treated as same-origin.
 * Apply to every session-cookie mutation as CSRF defence in depth on top of
 * SameSite=Lax (which a sibling subdomain could bypass).
 */
export function sameOrigin(request: Request): boolean {
  const o = request.headers.get("origin");
  if (!o) return true;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  try {
    return !!host && new URL(o).host === host;
  } catch {
    return false;
  }
}
export function verifySessionValue(value: string | undefined | null): Session | null {
  // Fail closed: an empty AUTH_SECRET would sign sessions with a known key,
  // making every session forgeable. Reject everything instead.
  const secret = process.env.AUTH_SECRET;
  if (!value || !secret) return null;
  try {
    const [b64, exp, sig] = value.split(".");
    if (!b64 || !exp || !sig || Number(exp) < Date.now()) return null;
    const expected = createHmac("sha256", secret).update(`${b64}.${exp}`).digest("base64url");
    if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
    const p = JSON.parse(Buffer.from(b64, "base64url").toString());
    const email = String(p.e || "");
    if (String(p.v ?? "1") !== epoch()) return null;
    return email ? { email, name: String(p.n || ""), picture: String(p.p || "") } : null;
  } catch {
    return null;
  }
}
