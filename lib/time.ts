/** Stamp a snapshot with the server's current time (for client clock-offset math). */
export function stampServerTime<T extends { serverAt?: number }>(s: T): T {
  return { ...s, serverAt: Date.now() };
}

/** Relative "3d ago"-style label at every age: m → h → d → w → mo → y. */
export function relTime(value: string | number, now = Date.now()): string {
  const t = typeof value === "string" ? Date.parse(value) : value;
  if (!t || Number.isNaN(t)) return "Date unavailable";
  const diff = Math.max(0, now - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (days < 365) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
