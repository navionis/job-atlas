import { createHmac, timingSafeEqual } from "node:crypto";
export type Session = { email: string; name: string; picture: string };
const SESSION_AGE = 7 * 24 * 3600 * 1000;
export function sessionCookieHeader(s: Session, secure: boolean): string | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  const exp = Date.now() + SESSION_AGE;
  const data = `${Buffer.from(JSON.stringify({ e: s.email, n: s.name, p: s.picture }), "utf8").toString("base64url")}.${exp}`;
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `atlas_session=${data}.${sig}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_AGE / 1000}${secure ? "; Secure" : ""}`;
}
export function getSession(request: Request): Session | null {
  const raw = (request.headers.get("cookie") || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("atlas_session="));
  return raw ? verifySessionValue(decodeURIComponent(raw.slice("atlas_session=".length))) : null;
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
    return email ? { email, name: String(p.n || ""), picture: String(p.p || "") } : null;
  } catch {
    return null;
  }
}
