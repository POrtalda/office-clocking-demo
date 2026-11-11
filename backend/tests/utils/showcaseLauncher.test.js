const { spawnSync } = require("child_process");
const path = require("path");
const script = path.resolve(__dirname, "../../scripts/startShowcaseLocal.js");
const local = { ...process.env, NODE_ENV: "development", DEMO_MODE: "true", DEMO_LOCAL_GPS_BYPASS: "true", MONGO_URI: "mongodb://127.0.0.1:27017/office_clocking_showcase_v2", PORT: "5055", CLIENT_URL: "http://127.0.0.1:5175", JWT_SECRET: "test-only-not-a-real-key" };
test("configuration check succeeds without opening a DB connection", () => {
  const result = spawnSync(process.execPath, [script, "--check"], { env: local, encoding: "utf8", timeout: 5000 });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("Nessuna connessione aperta");
  expect(result.stdout).not.toContain(local.JWT_SECRET);
});
test.each([
  { NODE_ENV: "production" },
  { MONGO_URI: "mongodb://127.0.0.1:27017/office_clocking" },
  { CLIENT_URL: "https://production.example.com" },
  { PORT: "5000" },
])("launcher rejects inherited unsafe settings before connecting: %j", patch => {
  const result = spawnSync(process.execPath, [script, "--check"], { env: { ...local, ...patch }, encoding: "utf8", timeout: 5000 });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Nessuna connessione aperta");
});
