// Refreshes due job feeds into the shared store (file or Postgres).
// Keeps the cache warm so page requests never wait on upstream fetches.
// Run:      npm run sync:jobs             — refresh feeds whose TTL elapsed
//           npm run sync:jobs -- --force  — refresh every enabled feed now
// Schedule: cron/Render Cron — e.g. `*/15 * * * * npm run sync:jobs`
import { readFileSync } from "node:fs";

// Standalone runs don't get Next's env loading — pull .env if present.
try {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {}

const { syncAll } = await import("../lib/feeds");
const started = Date.now();
const force = process.argv.includes("--force");
console.log(`[sync] ${new Date().toISOString()} — starting${force ? " (forced)" : ""}`);
try {
  const r = await syncAll(force);
  console.log(
    `[sync] done in ${r.took}ms — ${r.refreshed.length} refreshed, ${r.skipped} skipped (TTL), ` +
      `${r.failed.length} failed, ${r.jobs} live jobs`,
  );
  for (const id of r.refreshed) console.log(`  ok   ${id}`);
  for (const f of r.failed) console.log(`  FAIL ${f.id}: ${f.error}`);
  process.exit(r.failed.length ? 2 : 0);
} catch (e) {
  console.error(`[sync] fatal after ${Date.now() - started}ms:`, e instanceof Error ? e.message : e);
  process.exit(1);
}
