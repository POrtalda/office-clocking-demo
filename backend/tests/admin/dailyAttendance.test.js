const request = require("supertest");
jest.mock("../../models/TimeRecord", () => ({ find: jest.fn() }));
jest.mock("../../models/LeaveRequest", () => ({ find: jest.fn() }));
jest.mock("../../models/User", () => ({ find: jest.fn() }));
jest.mock("jsonwebtoken", () => ({ verify: jest.fn() }));
const TimeRecord = require("../../models/TimeRecord");
const LeaveRequest = require("../../models/LeaveRequest");
const User = require("../../models/User");
const jwt = require("jsonwebtoken");
const app = require("../../app");
function query(value) {
  const q = { lean: jest.fn().mockResolvedValue(value) };
  for (const method of ["select", "sort"]) q[method] = jest.fn().mockReturnValue(q);
  return q;
}
const get = () => request(app).get("/api/admin/daily-attendance").set("Authorization", "Bearer test");
beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
  jest.setSystemTime(new Date("2026-11-10T08:30:00Z"));
  jwt.verify.mockReturnValue({ id: "admin", username: "admin", role: "admin" });
  User.find.mockReturnValue(query([]));
  TimeRecord.find.mockReturnValue(query([]));
  LeaveRequest.find.mockReturnValue(query([]));
});
afterEach(() => jest.useRealTimers());
test("requires authentication and admin role", async () => {
  expect((await request(app).get("/api/admin/daily-attendance")).status).toBe(401);
  jwt.verify.mockReturnValue({ id: "employee", role: "user" });
  expect((await get()).status).toBe(403);
  expect(User.find).not.toHaveBeenCalled();
});
test("classifies employees once, picks the first entry and excludes hourly PIR from full-day absences", async () => {
  const ids = ["entered", "missing", "holiday", "sick", "hourly", "pir"];
  User.find.mockReturnValue(query(ids.map(id => ({ _id: id, username: id }))));
  TimeRecord.find.mockReturnValue(query([
    { user: "entered", clockIn: "2026-11-10T08:10:00Z", breaks: [{ startAt: "2026-11-10T08:20:00Z" }] },
    { user: "entered", clockIn: "2026-11-10T08:00:00Z" },
  ]));
  const day = { date: "2026-11-10T00:00:00Z" };
  LeaveRequest.find.mockReturnValue(query([
    { user: "holiday", type: "ferie", ...day },
    { user: "sick", type: "ferie", ...day },
    { user: "sick", type: "mutua", ...day },
    { user: "hourly", type: "pir", hours: 2, ...day },
    { user: "pir", type: "pir", hours: null, ...day },
  ]));
  const res = await get();
  expect(res.status).toBe(200);
  expect(res.body.counts).toEqual({ total: 6, entered: 1, missing: 2, absent: 3 });
  expect(res.body.entered[0].firstClockIn).toBe("2026-11-10T08:00:00Z");
  expect(res.body.missing.map(p => p.username)).toEqual(["missing", "hourly"]);
  expect(res.body.absent.find(p => p.username === "sick").type).toBe("mutua");
  expect(res.body.checkReached).toBe(true);
  expect(User.find).toHaveBeenCalledWith({ role: "user", isActive: { $ne: false } });
  expect(TimeRecord.find).toHaveBeenCalledWith(expect.objectContaining({
    status: { $ne: "cancelled" },
    clockIn: { $gte: new Date("2026-11-09T23:00:00Z"), $lt: new Date("2026-11-10T23:00:00Z") },
  }));
  expect(LeaveRequest.find).toHaveBeenCalledWith(expect.objectContaining({ status: "approved" }));
});
test.each([
  ["2026-11-10T07:59:00Z", false],
  ["2026-11-10T08:00:00Z", true],
])("09:00 threshold follows Europe/Rome: %s", async (now, reached) => {
  jest.setSystemTime(new Date(now));
  const res = await get();
  expect(res.status).toBe(200);
  expect(res.body.date).toBe("2026-11-10");
  expect(res.body.timezone).toBe("Europe/Rome");
  expect(res.body.checkReached).toBe(reached);
});
test("uses Rome's day across UTC midnight and covers multi-day absences", async () => {
  jest.setSystemTime(new Date("2026-11-09T23:30:00Z"));
  User.find.mockReturnValue(query([{ _id: "holiday", username: "holiday" }]));
  LeaveRequest.find.mockReturnValue(query([{ user: "holiday", type: "ferie", startDate: "2026-11-09T23:00:00Z", endDate: "2026-11-12T22:59:59Z" }]));
  const res = await get();
  expect(res.status).toBe(200);
  expect(res.body.date).toBe("2026-11-10");
  expect(res.body.counts.absent).toBe(1);
  expect(res.body.checkReached).toBe(false);
});

test("supports the selected historical day with a Rome day range", async () => {
  User.find.mockReturnValue(query([{ _id: "entered", username: "entered" }]));
  TimeRecord.find.mockReturnValue(query([{ user: "entered", clockIn: "2026-03-29T08:00:00Z" }]));
  const res = await request(app).get("/api/admin/daily-attendance?date=2026-03-29").set("Authorization", "Bearer test");
  expect(res.status).toBe(200); expect(res.body.date).toBe("2026-03-29");
  expect(res.body.isToday).toBe(false); expect(res.body.counts.entered).toBe(1);
  expect(TimeRecord.find).toHaveBeenCalledWith(expect.objectContaining({ clockIn: { $gte: new Date("2026-03-28T23:00:00Z"), $lt: new Date("2026-03-29T22:00:00Z") } }));
});
test.each(["2026-02-30", "invalid", ""])("rejects invalid attendance date %s", async date => {
  const res = await request(app).get(`/api/admin/daily-attendance?date=${date}`).set("Authorization", "Bearer test");
  expect(res.status).toBe(400); expect(User.find).not.toHaveBeenCalled();
});
