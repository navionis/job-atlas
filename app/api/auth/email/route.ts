import { originOf, safeNext } from "../../../../lib/auth";
import { issueToken } from "../../../../lib/email-tokens";
import { withOrigin } from "../../../../lib/guard";
import { sendMagicLink } from "../../../../lib/mail";
import { clientIp, rateLimit } from "../../../../lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const POST = withOrigin(async (request) => {
  let email = "",
    next = "/";
  try {
    const body = await request.json();
    email = String(body.email || "")
      .trim()
      .toLowerCase();
    next = safeNext(String(body.next || ""));
  } catch {}
  if (!EMAIL_RE.test(email) || email.length > 200) return Response.json({ error: "Invalid email" }, { status: 400 });
  // Rate-limit both directions — per-IP stops bulk abuse, per-address stops
  // email-bombing a stranger through our sender.
  const ip = clientIp(request);
  if (!rateLimit(`email:ip:${ip}`, 5, 600_000) || !rateLimit(`email:addr:${email}`, 3, 600_000))
    return Response.json({ error: "Too many requests — try again in a few minutes" }, { status: 429 });
  const url = `${originOf(request)}/api/auth/email/verify?token=${await issueToken(email)}&next=${encodeURIComponent(next)}`;
  try {
    await sendMagicLink(email, url);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[auth] magic-link send failed:", e);
    return Response.json({ error: "Could not send right now — try again later" }, { status: 500 });
  }
});
