const request = require("supertest");
jest.mock("../../models/TimeRecord", () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock("../../models/LeaveRequest", () => ({ findOne: jest.fn() }));
jest.mock("../../models/User", () => ({ findById: jest.fn() }));
jest.mock("jsonwebtoken", () => ({ verify: jest.fn() }));
jest.mock("../../services/timeRecordLock", () => ({ withTimeRecordLock: jest.fn(async (_id, operation) => operation("test", async () => {})) }));
const TimeRecord = require("../../models/TimeRecord");
const LeaveRequest = require("../../models/LeaveRequest");
const User = require("../../models/User");
const jwt = require("jsonwebtoken");
const app = require("../../app");
const keys = ["NODE_ENV", "DEMO_MODE", "DEMO_LOCAL_GPS_BYPASS", "MONGO_URI", "GEOLOCATION_CLOCK_IN_ENABLED", "SHOWCASE_GPS_CHECK_DISABLED"];
const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
let record;
const post = (action, payload) => request(app).post(`/api/records/${action}`).set("Authorization", "Bearer test").send(payload);
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
  jest.setSystemTime(new Date("2026-11-10T12:00:00Z"));
  Object.assign(process.env, { NODE_ENV: "development", DEMO_MODE: "true", DEMO_LOCAL_GPS_BYPASS: "true", MONGO_URI: "mongodb://127.0.0.1:27017/office_clocking_showcase_v2", GEOLOCATION_CLOCK_IN_ENABLED: "true" });
  jwt.verify.mockReturnValue({ id: "employee", username: "mario", role: "user" });
  LeaveRequest.findOne.mockResolvedValue(null);
  User.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ geolocationEnabled: true }) }) });
  record = { clockIn: new Date("2026-11-10T08:00:00Z"), clockOut: null, status: "open", breaks: [], save: jest.fn().mockResolvedValue(true) };
  TimeRecord.findOne.mockReturnValue({ sort: jest.fn().mockImplementation(async () => record) });
  TimeRecord.create.mockImplementation(async data => data);
});
afterEach(() => {
  for (const key of keys) { if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key]; }
  jest.useRealTimers();
});
function prepare(action) {
  const saved = record;
  if (action === "clock-in") record = null;
  if (action === "break-end") record.breaks.push({ startAt: new Date("2026-11-10T11:00:00Z"), endAt: null });
  return saved;
}
test("GPS policy requires authentication and is denied when production is configured", async () => {
  expect((await request(app).get("/api/records/gps-policy")).status).toBe(401);
  const get = () => request(app).get("/api/records/gps-policy").set("Authorization", "Bearer test");
  expect((await get()).body.canSkipGps).toBe(true);
  process.env.NODE_ENV = "production";
  expect((await get()).body.canSkipGps).toBe(false);
});
test.each(["clock-in", "clock-out", "break-start", "break-end"])("local demo %s works without coordinates or geolocation validation", async action => {
  const saved = prepare(action);
  const res = await post(action, { demoWithoutGps: true });
  expect(res.status).toBe(action === "clock-in" ? 201 : 200);
  expect(User.findById).not.toHaveBeenCalled();
  if (action === "clock-in") expect(TimeRecord.create.mock.calls[0][0].clockInLocation).toBeNull();
  if (action === "clock-out") expect(saved.clockOutLocation).toBeNull();
  if (action === "break-start") expect(saved.breaks[0].startLocation).toBeNull();
  if (action === "break-end") expect(saved.breaks[0].endLocation).toBeNull();
});
test.each(["clock-in", "clock-out", "break-start", "break-end"])("production %s rejects a forged demo bypass marker", async action => {
  const saved = prepare(action);
  process.env.NODE_ENV = "production";
  const res = await post(action, { demoWithoutGps: true });
  expect(res.status).toBe(403);
  expect(res.body.code).toBe("DEMO_GPS_BYPASS_NOT_ALLOWED");
  expect(saved.save).not.toHaveBeenCalled();
  expect(TimeRecord.create).not.toHaveBeenCalled();
});
test.each(["clock-in", "clock-out", "break-start", "break-end"])("normal %s still rejects missing GPS with geolocation enabled", async action => {
  prepare(action);
  process.env.DEMO_MODE = "false";
  const res = await post(action, {});
  expect(res.status).toBe(400);
  expect(res.body.code).toBe("INVALID_LOCATION");
});
test("proxy headers cannot enable GPS omission even in a local demo environment", async () => {
  const res = await request(app).post("/api/records/break-start").set("Authorization", "Bearer test").set("X-Forwarded-For", "127.0.0.1").send({ demoWithoutGps: true });
  expect(res.status).toBe(403);
  expect(record.save).not.toHaveBeenCalled();
});

test.each(["clock-in", "clock-out", "break-start", "break-end"])("ordinary production %s rejects remote Showcase marker even with flag set",async action=>{
 const saved=prepare(action);process.env.NODE_ENV="production";process.env.SHOWCASE_GPS_CHECK_DISABLED="true";
 const res=await post(action,{showcaseWithoutGps:true});
 expect(res.status).toBe(403);expect(res.body.code).toBe("SHOWCASE_GPS_BYPASS_NOT_ALLOWED");expect(saved.save).not.toHaveBeenCalled();expect(TimeRecord.create).not.toHaveBeenCalled();
});
