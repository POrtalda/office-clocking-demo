import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createSectionScope, sectionPreferenceKey, readSectionPreference, writeSectionPreference, revealSection } from "../src/utils/sectionPreferences.js";
const memory = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), data }; };
test("first visit is closed and open/closed preferences survive subsequent reads", async () => {
  const storage = memory(); const scope = await createSectionScope({ username: "account-a", role: "user" }, "home-user", webcrypto);
  const key = sectionPreferenceKey(scope, "leave-requests");
  assert.equal(readSectionPreference(storage, key), false);
  writeSectionPreference(storage, key, true); assert.equal(readSectionPreference(storage, key), true);
  writeSectionPreference(storage, key, false); assert.equal(readSectionPreference(storage, key), false);
  assert.equal(storage.data.get(key), "false");
});
test("scopes are distinct for accounts, roles, pages and sections and contain no account name", async () => {
  const a = await createSectionScope({ username: "account-a", role: "user" }, "home-user", webcrypto);
  const b = await createSectionScope({ username: "account-b", role: "user" }, "home-user", webcrypto);
  const admin = await createSectionScope({ username: "account-a", role: "admin" }, "home-user", webcrypto);
  const page = await createSectionScope({ username: "account-a", role: "user" }, "other-page", webcrypto);
  assert.equal(new Set([a,b,admin,page]).size, 4); assert.ok(!a.includes("account-a"));
  const storage = memory(); writeSectionPreference(storage, sectionPreferenceKey(a, "one"), true);
  for (const scope of [b,admin,page]) assert.equal(readSectionPreference(storage, sectionPreferenceKey(scope, "one")), false);
  assert.equal(readSectionPreference(storage, sectionPreferenceKey(a, "two")), false);
  assert.equal(await createSectionScope({ username: "account-a", role: "user" }, "home-user", webcrypto), a);
});
test("malformed, oversized, non-boolean and unavailable storage falls back safely to closed", () => {
  for (const value of [null, "bad", "1", '"true"', '{"open":true}', "x".repeat(50000), "null", "[]"]) assert.equal(readSectionPreference({ getItem: () => value }, "key"), false);
  const denied = { getItem() { throw new Error("Denied"); }, setItem() { throw new Error("Quota"); } };
  assert.equal(readSectionPreference(denied, "key"), false);
  assert.doesNotThrow(() => writeSectionPreference(denied, "key", true));
  assert.equal(readSectionPreference(null, "key"), false);
});
test("missing identity or WebCrypto never writes shared anonymous preferences", async () => {
  assert.equal(await createSectionScope(null, "home-user", webcrypto), null);
  assert.equal(await createSectionScope({ username: "a", role: "user" }, "home-user", {}), null);
  const storage = memory(); writeSectionPreference(storage, null, true); assert.equal(storage.data.size, 0);
});
test("quick navigation opens only a closed target via its real button handler", () => {
  let clicks = 0; const button = { getAttribute: () => "false", click: () => { clicks++; } };
  revealSection({ querySelector: () => button }); assert.equal(clicks, 1);
  revealSection({ querySelector: () => ({ ...button, getAttribute: () => "true" }) }); assert.equal(clicks, 1);
});
