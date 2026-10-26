import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { dbConsumeEmailToken, dbCreateEmailToken, pgEnabled } from "./db";

export const TOKEN_TTL = 10 * 60 * 1000;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

// File fallback for DATABASE_URL-less dev — same shape as profiles.json.
type Rec = { email: string; expiresAt: number; usedAt?: number };
const dir = process.env.DATA_DIR || join(process.cwd(), ".data");
const file = join(dir, "email-tokens.json");
function loadAll(): Record<string, Rec> {
  try {
    const d = JSON.parse(readFileSync(file, "utf8"));
    return d && typeof d === "object" ? d : {};
  } catch {
    return {};
  }
}
function saveAll(all: Record<string, Rec>) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(file + ".tmp", JSON.stringify(all));
  renameSync(file + ".tmp", file);
}

/** Mint a single-use sign-in token for `email`; returns the raw token (emailed, never stored). */
export async function issueToken(email: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const h = hash(token);
  const expiresAt = Date.now() + TOKEN_TTL;
  if (pgEnabled()) {
    await dbCreateEmailToken(h, email, expiresAt);
  } else {
    const all = loadAll();
    // Prune dead tokens while we're here — the file store has no index.
    for (const k of Object.keys(all)) if (all[k].expiresAt < Date.now() || all[k].usedAt) delete all[k];
    all[h] = { email, expiresAt };
    saveAll(all);
  }
  return token;
}

/** Redeem `token` — returns the email iff it exists, is unused, and unexpired. Consumes on success. */
export async function consumeToken(token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return null;
  const h = hash(token);
  if (pgEnabled()) return dbConsumeEmailToken(h);
  const all = loadAll();
  const r = all[h];
  if (!r || r.usedAt || r.expiresAt < Date.now()) return null;
  r.usedAt = Date.now();
  saveAll(all);
  return r.email;
}
