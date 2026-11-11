import test from "node:test";
import assert from "node:assert/strict";
import { isLocalDemoGpsCandidate, getClockLocationPayload } from "../src/utils/localDemoGps.js";
const env = { DEV: true, MODE: "demo-local", VITE_DEMO_MODE: "true", VITE_DEMO_LOCAL_GPS_BYPASS: "true", VITE_API_URL: "http://127.0.0.1:5055" };
test("requires the explicit localhost demo development mode", () => {
  assert.equal(isLocalDemoGpsCandidate(env, "127.0.0.1"), true);
});
for (const patch of [
  { DEV: false }, { MODE: "production" }, { MODE: "development" },
  { VITE_DEMO_MODE: "false" }, { VITE_DEMO_LOCAL_GPS_BYPASS: undefined },
  { VITE_API_URL: "https://api.example.com" }, { VITE_API_URL: "http://localhost.evil.test:5055" },
  { VITE_API_URL: undefined },
]) test(`production build/misconfiguration does not enable bypass: ${JSON.stringify(patch)}`, () => {
  assert.equal(isLocalDemoGpsCandidate({ ...env, ...patch }, "127.0.0.1"), false);
});
test("a public frontend host cannot use local demo GPS omission", () => {
  assert.equal(isLocalDemoGpsCandidate(env, "demo.example.com"), false);
});
test("approved demo requests never call GPS and contain no synthetic coordinates", async () => {
  const payload = await getClockLocationPayload({ allowWithoutGps: true, requestPosition: () => { throw new Error("GPS must not be called"); } });
  assert.deepEqual(payload, { demoWithoutGps: true });
  assert.equal("location" in payload, false);
});
test("normal mode calls GPS and forwards only the actual device coordinates", async () => {
  let called = 0;
  const coords = { latitude: 45.1, longitude: 9.2, accuracy: 12 };
  const payload = await getClockLocationPayload({ allowWithoutGps: false, requestPosition: async () => { called++; return { coords }; } });
  assert.equal(called, 1);
  assert.deepEqual(payload, { location: coords });
});
test("unavailable policy or a non-boolean approval keeps GPS required", async () => {
  for (const allowWithoutGps of [undefined, false, "true"]) {
    await assert.rejects(() => getClockLocationPayload({ allowWithoutGps, requestPosition: async () => { throw new Error("GPS denied"); } }), /GPS denied/);
  }
});
