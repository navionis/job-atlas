import { test } from "node:test";
import assert from "node:assert/strict";
import { newDb } from "pg-mem";
import type { Pool } from "pg";
import { setPoolForTesting } from "../lib/db";
import { consumeToken, issueToken } from "../lib/email-tokens";

test("email magic-link tokens are single-use and validate format", async () => {
  process.env.DATABASE_URL = "postgres://pg-mem";
  const mem = newDb();
  const { Pool: MemPool } = mem.adapters.createPg();
  setPoolForTesting(new MemPool() as unknown as Pool);

  const token = await issueToken("user@example.com");
  // Raw tokens are never stored — only their sha256.
  assert.equal(mem.public.many(`select email from email_tokens where hash='${token}'`).length, 0);
  assert.equal(await consumeToken(token), "user@example.com");
  // Replay must fail — the row is now consumed.
  assert.equal(await consumeToken(token), null);
  // Malformed and unknown tokens never reach a session.
  assert.equal(await consumeToken("not a token"), null);
  assert.equal(await consumeToken("a".repeat(43)), null);
  setPoolForTesting(undefined);
  delete process.env.DATABASE_URL;
});
