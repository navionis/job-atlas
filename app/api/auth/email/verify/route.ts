import { originOf, safeNext, sessionCookieHeader } from "../../../../../lib/auth";
import { consumeToken, peekToken } from "../../../../../lib/email-tokens";
import { ensureAdmin } from "../../../../../lib/feeds";
import { withOrigin } from "../../../../../lib/guard";
import { clientIp, rateLimit } from "../../../../../lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const expired = (origin: string) => Response.redirect(origin + "/login?error=link");

// Interstitial: mail security scanners prefetch every link in an email — if
// GET consumed the token, the user's real click would land on a dead link.
// GET peeks and renders a confirm page; only this POST actually signs in.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const confirmPage = (token: string, next: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Sign in — Job Atlas</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;font-family:system-ui,sans-serif;color:#0f172a}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;max-width:340px;text-align:center;box-shadow:0 4px 16px rgba(15,23,42,.08)}
h1{font-size:18px;margin:0 0 8px;letter-spacing:-.4px}p{font-size:12px;color:#64748b;margin:0 0 20px;line-height:1.6}
button{width:100%;padding:11px;border:0;border-radius:8px;background:#1d4ed8;color:#fff;font-size:13px;font-weight:600;cursor:pointer}
button:hover{filter:brightness(1.08)}.b{color:#1d4ed8}</style></head>
<body><div class="card"><h1>job atlas<span class="b">.</span></h1>
<p>Confirm to finish signing in. This link works once and expires quickly.</p>
<form method="post" action="/api/auth/email/verify"><input type="hidden" name="token" value="${esc(token)}">
<input type="hidden" name="next" value="${esc(next)}">
<button type="submit">Sign in</button></form></div></body></html>`;

export async function GET(request: Request) {
  const origin = originOf(request);
  if (!rateLimit(`verify:${clientIp(request)}`, 30, 60_000)) return expired(origin);
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const next = safeNext(url.searchParams.get("next"));
  if (!(await peekToken(token))) return expired(origin);
  return new Response(confirmPage(token, next), { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export const POST = withOrigin(async (request) => {
  const origin = originOf(request);
  if (!rateLimit(`verify:${clientIp(request)}`, 30, 60_000)) return expired(origin);
  const form = await request.formData().catch(() => null);
  const token = String(form?.get("token") || new URL(request.url).searchParams.get("token") || "");
  const next = safeNext(String(form?.get("next") || new URL(request.url).searchParams.get("next") || ""));
  const email = await consumeToken(token);
  if (!email) return expired(origin);
  await ensureAdmin(email);
  const cookie = sessionCookieHeader({ email, name: email.split("@")[0], picture: "" }, origin.startsWith("https:"));
  if (!cookie) {
    console.error("[auth] AUTH_SECRET is not set — refusing to issue sessions");
    return Response.redirect(origin + "/login?error=config");
  }
  const headers = new Headers({ Location: origin + next });
  headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
});
