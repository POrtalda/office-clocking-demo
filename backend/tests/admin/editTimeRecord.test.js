const request = require("supertest");
jest.mock("../../models/TimeRecord", () => ({ findById: jest.fn(), findOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock("jsonwebtoken", () => ({ verify: jest.fn() }));
jest.mock("../../services/timeRecordLock", () => ({ withTimeRecordLock: jest.fn(async (_id, operation) => operation("test", async () => {})) }));
const TimeRecord = require("../../models/TimeRecord");
const jwt = require("jsonwebtoken");
const { withTimeRecordLock } = require("../../services/timeRecordLock");
const { parseLocalRecordDateTime } = require("../../controllers/adminRecordEditController");
const app = require("../../app");
const id = "507f1f77bcf86cd799439011";
const adminId = "507f1f77bcf86cd799439012";
let record;
const query = data => ({ lean: jest.fn().mockResolvedValue(data), select: jest.fn().mockReturnThis() });
const payload = () => ({ clockIn: "2026-11-11T08:30:00", clockOut: "2026-11-11T17:30:00", reason: "Correzione concordata", expectedClockIn: record.clockIn, expectedClockOut: record.clockOut });
const patch = body => request(app).patch(`/api/admin/records/${id}`).set("Authorization", "Bearer test").send(body);
beforeEach(() => {
  jest.clearAllMocks();
  jwt.verify.mockReturnValue({ id: adminId, username: "admin", role: "admin" });
  record = { _id: id, user: "employee", status: "closed", clockIn: new Date("2026-11-11T07:00:00Z"), clockOut: new Date("2026-11-11T16:00:00Z"), updatedAt: new Date("2026-11-11T17:00:00Z"), __v: 2,
    breaks: [{ startAt: "2026-11-11T09:00:00Z", endAt: "2026-11-11T09:15:00Z" }, { startAt: "2026-11-11T11:00:00Z", endAt: "2026-11-11T12:00:00Z" }], adminEditHistory: [{ reason: "Prima correzione" }] };
  TimeRecord.findById.mockImplementation(() => query(record));
  TimeRecord.findOne.mockReturnValue(query(null));
  TimeRecord.findOneAndUpdate.mockImplementation((_filter, update) => query({ ...record, ...update.$set, adminEditHistory: [...record.adminEditHistory, update.$push.adminEditHistory] }));
});
test("requires authenticated admin authorization", async () => {
  expect((await request(app).patch(`/api/admin/records/${id}`).send(payload())).status).toBe(401);
  jwt.verify.mockReturnValue({ id: "employee", role: "user" });
  expect((await patch(payload())).status).toBe(403);
  expect(TimeRecord.findById).not.toHaveBeenCalled();
});
test("corrects dates in Rome, recalculates all breaks and appends audit history atomically", async () => {
  const res = await patch(payload());
  expect(res.status).toBe(200);
  expect(withTimeRecordLock).toHaveBeenCalledWith("employee", expect.any(Function));
  expect(res.body.record.durationSec).toBe(27900); expect(res.body.record.breakSec).toBe(4500);
  expect(res.body.record.adminEditHistory).toHaveLength(2);
  const [filter, update, options] = TimeRecord.findOneAndUpdate.mock.calls[0];
  expect(filter).toMatchObject({ status: "closed", __v: 2, updatedAt: record.updatedAt });
  expect(update.$set).toEqual({ clockIn: new Date("2026-11-11T07:30:00Z"), clockOut: new Date("2026-11-11T16:30:00Z"), durationSec: 27900 });
  expect(update.$push.adminEditHistory).toMatchObject({ reason: "Correzione concordata", editedBy: adminId, previousClockIn: record.clockIn, editedAt: expect.any(Date) });
  expect(options.runValidators).toBe(true);
  expect(TimeRecord.findOne).toHaveBeenCalledWith(expect.objectContaining({ clockIn: { $lt: update.$set.clockOut }, $or: [{ clockOut: { $gt: update.$set.clockIn } }, { clockOut: null }] }));
});
test.each([
  { reason: " " }, { reason: 12 }, { reason: "x".repeat(1001) },
  { clockOut: "2026-11-11T08:00:00" }, { clockIn: "invalid" },
  { clockIn: "2026-02-30T09:00:00" }, { clockIn: "2026-11-11T25:00:00" },
])("rejects invalid correction %j without saving", async change => {
  expect((await patch({ ...payload(), ...change })).status).toBe(400);
  expect(TimeRecord.findOneAndUpdate).not.toHaveBeenCalled();
});
test("rejects completed breaks outside the corrected session", async () => {
  const res = await patch({ ...payload(), clockIn: "2026-11-11T10:30:00" });
  expect(res.status).toBe(400); expect(res.body.code).toBe("BREAK_RANGE_CONFLICT");
});
test("rejects overlapping or unfinished neighboring sessions", async () => {
  TimeRecord.findOne.mockReturnValue(query({ _id: "other" }));
  const res = await patch(payload());
  expect(res.status).toBe(409); expect(res.body.code).toBe("RECORD_OVERLAP");
  expect(TimeRecord.findOneAndUpdate).not.toHaveBeenCalled();
});
test.each(["cancelled", "open", "pending_manual_closure"])("rejects non-editable state %s", async status => {
  record.status = status;
  expect((await patch(payload())).status).toBe(409);
  expect(TimeRecord.findOneAndUpdate).not.toHaveBeenCalled();
});
test("rejects an outdated form", async () => {
  const res = await patch({ ...payload(), expectedClockIn: "2026-11-11T06:00:00Z" });
  expect(res.status).toBe(409); expect(res.body.code).toBe("STALE_RECORD");
});
test("detects an atomic update race without overwriting data", async () => {
  TimeRecord.findOneAndUpdate.mockReturnValue(query(null));
  const res = await patch(payload());
  expect(res.status).toBe(409); expect(res.body.code).toBe("STALE_RECORD");
});
test.each(["2026-03-29T02:30:00", "2026-10-25T02:30:00"])("rejects nonexistent or ambiguous Rome correction time %s", local => {
  expect(parseLocalRecordDateTime(local)).toBeNull();
});
