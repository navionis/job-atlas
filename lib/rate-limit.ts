// Fixed-window rate limiter — in-memory, per-process. Sufficient for a
// single-instance deployment; a multi-replica setup would need a shared store.
const hits = new Map<string, { n: number; reset: number }>();
let sweeps = 0;
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (++sweeps % 64 === 0) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  return ++h.n <= limit;
}
export function clientIp(request: Request): string {
  return (
    (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || request.headers.get("x-real-ip") || "local"
  );
}
