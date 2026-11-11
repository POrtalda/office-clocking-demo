const request = require("supertest");
jest.mock("../../models/TimeRecord", () => ({ find: jest.fn(), findById: jest.fn() }));
jest.mock("../../models/User", () => ({ find: jest.fn(), findOne: jest.fn() }));
jest.mock("../../models/LeaveRequest", () => ({ find: jest.fn() }));
jest.mock("jsonwebtoken", () => ({ verify: jest.fn() }));
const app = require("../../app");
const TimeRecord = require("../../models/TimeRecord");
const User = require("../../models/User");
const LeaveRequest = require("../../models/LeaveRequest");
const jwt = require("jsonwebtoken");
const at = time => `2026-11-10T${time}:00.000Z`;
const user = { _id: "employee", username: "mario", role: "user", isActive: true };
const fixture = () => ({ _id: "record", user: user._id, status: "closed", clockIn: at("08:00"), clockOut: at("17:00"), durationSec: 32400,
  breaks: [{ startAt: at("10:00"), endAt: at("10:15") }, { startAt: at("12:00"), endAt: at("13:00") }] });
function query(value) {
  const q = { lean: jest.fn().mockResolvedValue(value) };
  for (const method of ["select", "sort", "populate"]) q[method] = jest.fn().mockReturnValue(q);
  return q;
}
const get = url => request(app).get(url).set("Authorization", "Bearer test");
beforeEach(() => {
  jest.resetAllMocks();
  jwt.verify.mockReturnValue({ id: "admin", role: "admin", username: "admin" });
  User.findOne.mockReturnValue(query(user));
  User.find.mockReturnValue(query([user]));
  LeaveRequest.find.mockReturnValue(query([]));
  TimeRecord.find.mockReturnValue(query([fixture()]));
});
test("single-user and all-user summaries use the same net duration as their details", async () => {
  const one = await get("/api/admin/summary?username=mario&from=2026-11-01&to=2026-11-30");
  expect(one.status).toBe(200);
  expect(one.body.totalSec).toBe(27900);
  expect(one.body.records[0]).toMatchObject({ durationSec: 27900, effectiveDurationSec: 27900, breakSec: 4500 });
  const all = await get("/api/admin/summary-all?from=2026-11-01&to=2026-11-30&includeRecords=true");
  expect(all.status).toBe(200);
  expect(all.body.rows[0].totalSec).toBe(27900);
});
test("CSV exports net hours and every break interval with aligned absence columns", async () => {
  TimeRecord.find.mockReturnValue(query([{ ...fixture(), user }]));
  LeaveRequest.find.mockReturnValue(query([{ user, date: at("00:00"), type: "ferie", status: "approved", note: 'Note; con "virgolette"' }]));
  const res = await get("/api/admin/export?from=2026-11-01&to=2026-11-30");
  expect(res.status).toBe(200);
  const lines = res.text.trim().split("\n");
  expect(lines[0].split(";")).toHaveLength(23);
  const line = lines.find(l => l.startsWith("timbratura;"));
  expect(line).toContain(";27900;07:45:00;");
  expect(line).toContain(";4500;01:15:00;");
  expect(line).toContain(at("10:00"));
  expect(line).toContain(at("13:00"));
  expect(lines.find(l => l.startsWith("assenza;"))).toContain('"Note; con ""virgolette"""');
});
test.each(["date=2026-11-10", "from=2026-11-01&to=2026-11-30"])("personal history returns net hours without saving: %s", async params => {
  const record = fixture();
  TimeRecord.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([record]) });
  const res = await get(`/api/records/my?${params}`);
  expect(res.status).toBe(200);
  expect(res.body.records[0]).toMatchObject({ durationSec: 27900, breakSec: 4500 });
  expect(record.durationSec).toBe(32400);
});
test("pending manual closure preview subtracts completed breaks", async () => {
  const record = { ...fixture(), clockOut: null, status: "pending_manual_closure", manualClosureRequest: { proposedClockOut: at("17:00") } };
  TimeRecord.find.mockReturnValue(query([record]));
  const res = await get("/api/admin/manual-closure-requests");
  expect(res.status).toBe(200);
  expect(res.body.records[0].proposedDurationSec).toBe(27900);
});
test("approval saves net hours and closes an unfinished break at the proposed exit", async () => {
  const record = { ...fixture(), clockOut: null, status: "pending_manual_closure", manualClosureRequest: { proposedClockOut: at("17:00") }, save: jest.fn().mockResolvedValue(true) };
  record.breaks.push({ startAt: at("16:30"), endAt: null });
  TimeRecord.findById.mockResolvedValueOnce(record).mockReturnValueOnce(query({ ...record, clockOut: at("17:00"), status: "closed" }));
  const res = await request(app).post("/api/admin/manual-closure-requests/record/approve").set("Authorization", "Bearer test").send({});
  expect(res.status).toBe(200);
  expect(record.durationSec).toBe(26100);
  expect(record.breaks[2].endAt).toBe(at("17:00"));
  expect(record.save).toHaveBeenCalledTimes(1);
});
test("approval rejects closing before a completed break, without saving", async () => {
  const record = { ...fixture(), clockOut: null, status: "pending_manual_closure", manualClosureRequest: { proposedClockOut: at("12:30") }, save: jest.fn() };
  TimeRecord.findById.mockResolvedValue(record);
  const res = await request(app).post("/api/admin/manual-closure-requests/record/approve").set("Authorization", "Bearer test").send({});
  expect(res.status).toBe(400);
  expect(res.body.code).toBe("BREAK_RANGE_CONFLICT");
  expect(record.save).not.toHaveBeenCalled();
});
