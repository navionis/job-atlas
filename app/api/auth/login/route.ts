export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function originOf(request: Request) {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
  const proto = request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "");
  return `${proto}://${host}`;
}
export async function GET(request: Request) {
  const origin = originOf(request);
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) return Response.redirect(origin + "/");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", id);
  url.searchParams.set("redirect_uri", origin + "/api/auth/callback");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  const next = new URL(request.url).searchParams.get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) url.searchParams.set("state", next);
  return Response.redirect(url);
}
