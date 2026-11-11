const { canUseLocalDemoGps, isLocalShowcaseEnvironment } = require("../../utils/localDemoGps");
const env = { NODE_ENV: "development", DEMO_MODE: "true", DEMO_LOCAL_GPS_BYPASS: "true", MONGO_URI: "mongodb://127.0.0.1:27017/office_clocking_showcase_v2" };
const req = () => ({ socket: { remoteAddress: "127.0.0.1" }, headers: { host: "127.0.0.1:5055", origin: "http://127.0.0.1:5175" } });
test("only an explicit local development showcase environment authorizes GPS omission", () => {
  expect(isLocalShowcaseEnvironment(env)).toBe(true);
  expect(canUseLocalDemoGps(req(), env)).toBe(true);
});
test.each([
  { NODE_ENV: "production" }, { NODE_ENV: "test" }, { NODE_ENV: undefined },
  { DEMO_MODE: "false" }, { DEMO_MODE: undefined }, { DEMO_LOCAL_GPS_BYPASS: undefined },
  { DEMO_LOCAL_GPS_BYPASS: "TRUE" }, { MONGO_URI: undefined },
  { MONGO_URI: "mongodb://127.0.0.1:27017/office_clocking" },
  { MONGO_URI: "mongodb://db.example.com:27017/office_clocking_showcase_v2" },
  { MONGO_URI: "mongodb+srv://localhost/office_clocking_showcase_v2" },
  { MONGO_URI: "mongodb://localhost.evil.test/office_clocking_showcase_v2" },
])("rejects unsafe/missing environment configuration %j", patch => {
  expect(canUseLocalDemoGps(req(), { ...env, ...patch })).toBe(false);
});
test.each(["192.168.1.2", "203.0.113.1", undefined])("rejects non-loopback remote address %s", remoteAddress => {
  expect(canUseLocalDemoGps({ ...req(), socket: { remoteAddress } }, env)).toBe(false);
});
test.each([
  { host: "demo.example.com" }, { host: "localhost.evil.test" }, { host: undefined },
  { origin: "https://production.example.com" }, { origin: "null" },
  { "x-forwarded-for": "127.0.0.1" }, { "x-forwarded-host": "localhost" },
  { forwarded: "for=127.0.0.1" },
])("rejects public host/origin and proxy headers %j", patch => {
  const request = req(); request.headers = { ...request.headers, ...patch };
  expect(canUseLocalDemoGps(request, env)).toBe(false);
});
test.each(["::1", "::ffff:127.0.0.1"])("supports direct local IPv6 sockets %s", remoteAddress => {
  expect(canUseLocalDemoGps({ ...req(), socket: { remoteAddress } }, env)).toBe(true);
});
