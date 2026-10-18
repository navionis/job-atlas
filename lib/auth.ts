import { createHmac, timingSafeEqual } from "node:crypto";
export type Session = { email: string; name: string; picture: string };
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
