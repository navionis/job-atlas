import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifySessionValue, getSession } from "../lib/auth";

const SECRET = "test-secret-0123456789";
const make = (payload: object, exp = Date.now() + 60_000, secret = SECRET) => {
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(`${b64}.${exp}`).digest("base64url");
  return `${b64}.${exp}.${sig}`;
};

test("valid session verifies and returns identity", () => {
  process.env.AUTH_SECRET = SECRET;
  const s = verifySessionValue(make({ e: "a@b.com", n: "Ann", p: "https://pic" }));
  assert(s);
  assert.equal(s.email, "a@b.com");
  assert.equal(s.name, "Ann");
  assert.equal(s.picture, "https://pic");
});

test("tampered signature and wrong secret are rejected", () => {
  process.env.AUTH_SECRET = SECRET;
  const good = make({ e: "a@b.com" });
  const tampered = good.slice(0, -2) + "zz";
  assert.equal(verifySessionValue(tampered), null);
  process.env.AUTH_SECRET = "other-secret";
  assert.equal(verifySessionValue(good), null);
});

test("expired and malformed values are rejected", () => {
  process.env.AUTH_SECRET = SECRET;
  assert.equal(verifySessionValue(make({ e: "a@b.com" }, Date.now() - 1)), null);
  assert.equal(verifySessionValue(undefined), null);
  assert.equal(verifySessionValue(""), null);
  assert.equal(verifySessionValue("not.a.session"), null);
  assert.equal(verifySessionValue(".."), null);
});

test("payload without email is rejected", () => {
  process.env.AUTH_SECRET = SECRET;
  assert.equal(verifySessionValue(make({ n: "Ann" })), null);
});

test("getSession reads the atlas_session cookie only", () => {
  process.env.AUTH_SECRET = SECRET;
  const v = make({ e: "a@b.com" });
  const req = new Request("https://x", { headers: { cookie: `other=1; atlas_session=${v}` } });
  assert.equal(getSession(req)?.email, "a@b.com");
  assert.equal(getSession(new Request("https://x", { headers: { cookie: "other=1" } })), null);
});
