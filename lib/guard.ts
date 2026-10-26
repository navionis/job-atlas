import { forbidden, getSession, sameOrigin, unauthorized, type Session } from "./auth";
import { isAdminUser } from "./feeds";

type Ctx = { params?: unknown };
type Handler<C> = (me: Session, request: Request, ctx: C) => Response | Promise<Response>;
type Route<C> = (request: Request, ctx: C) => Promise<Response>;
type BareHandler<C> = (request: Request, ctx: C) => Response | Promise<Response>;

/**
 * Route wrappers — the guard lives in the export, not inside the handler:
 *
 *   export const POST = withUser(async (me, request) => { ... });
 *
 *   withSession  signed-in only                — safe reads (GET data routes)
 *   withOrigin   same-origin only              — session-less mutations (logout, onetap)
 *   withUser     signed-in + same-origin       — cookie-auth mutations
 *   withAdmin    withUser + admin membership   — /api/admin, /api/sources
 */
export function withSession<C = Ctx>(handler: Handler<C>): Route<C> {
  return async (request, ctx) => {
    const me = getSession(request);
    return me ? handler(me, request, ctx) : unauthorized();
  };
}
export function withOrigin<C = Ctx>(handler: BareHandler<C>): Route<C> {
  return async (request, ctx) => (sameOrigin(request) ? handler(request, ctx) : forbidden());
}
export function withUser<C = Ctx>(handler: Handler<C>): Route<C> {
  return async (request, ctx) => {
    const me = getSession(request);
    if (!me) return unauthorized();
    if (!sameOrigin(request)) return forbidden();
    return handler(me, request, ctx);
  };
}
export function withAdmin<C = Ctx>(handler: Handler<C>): Route<C> {
  return withUser<C>(async (me, request, ctx) =>
    (await isAdminUser(me.email)) ? handler(me, request, ctx) : Response.json({ error: "Admin only" }, { status: 403 }),
  );
}
