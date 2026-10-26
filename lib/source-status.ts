import type { SourceStatus } from "./types";

// Pill color per feed status — shared by the public Sources page and Admin.
const TONES: Record<string, string> = { connected: "green", loading: "amber", stale: "red", unavailable: "red" };
export const statusTone = (status: string) => TONES[status] || "";

// Sort rank: live → loading → stale/disabled → anything else. Used to order
// source listings so healthy feeds surface first.
const TIERS: Record<string, number> = { connected: 0, loading: 1, stale: 2, unavailable: 2, disabled: 3 };
export const statusTier = (status: string) => TIERS[status] ?? 4;

/** All feed instances belonging to a catalog provider ("greenhouse:acme" → "greenhouse"). */
export const sourcesOf = (sources: SourceStatus[], providerId: string) =>
  sources.filter((s) => s.id.split(":")[0] === providerId);
