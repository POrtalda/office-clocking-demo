const request = require("supertest");
jest.mock("../../models/TimeRecord", () => ({ findOne: jest.fn() }));
jest.mock("../../models/LeaveRequest", () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock("../../models/AppSettings", () => ({ findOneAndUpdate: jest.fn() }));
jest.mock("../../utils/email", () => ({ sendEmail: jest.fn() }));
jest.mock("jsonwebtoken", () => ({ verify: jest.fn() }));
const TimeRecord = require("../../models/TimeRecord");
const LeaveRequest = require("../../models/LeaveRequest");
const AppSettings = require("../../models/AppSettings");
const { sendEmail } = require("../../utils/email");
const jwt = require("jsonwebtoken");
const { getDayRangeInAppTz } = require("../../utils/dateTime");
const app = require("../../app");
const flush = () => new Promise(setImmediate);
const post = (type, body) => request(app).post(`/api/leaves/${type}`).set("Authorization", "Bearer test").send(body);
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
  jest.setSystemTime(new Date("2026-01-01T12:00:00Z"));
  jwt.verify.mockReturnValue({ id: "employee", username: "mario", role: "user" });
  LeaveRequest.findOne.mockResolvedValue(null); TimeRecord.findOne.mockResolvedValue(null);
  LeaveRequest.create.mockImplementation(async data => data);
  AppSettings.findOneAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue({ leaveMinAdvanceDays: 2, leaveNotificationEmails: ["admin@example.test"] }) });
  sendEmail.mockResolvedValue({ skipped: false });
});
afterEach(() => jest.useRealTimers());
test.each([
  ["2026-01-15", "2026-01-15", "2026-01-14T23:00:00.000Z", "2026-01-14T23:00:00.000Z", "15/01/2026", "15/01/2026"],
  ["2026-07-15", "2026-07-15", "2026-07-14T22:00:00.000Z", "2026-07-14T22:00:00.000Z", "15/07/2026", "15/07/2026"],
  ["2026-03-29", "2026-03-29", "2026-03-28T23:00:00.000Z", "2026-03-28T23:00:00.000Z", "29/03/2026", "29/03/2026"],
  ["2026-10-25", "2026-10-25", "2026-10-24T22:00:00.000Z", "2026-10-24T22:00:00.000Z", "25/10/2026", "25/10/2026"],
  ["2026-03-28", "2026-03-30", "2026-03-27T23:00:00.000Z", "2026-03-29T22:00:00.000Z", "28/03/2026", "30/03/2026"],
  ["2026-10-24", "2026-10-26", "2026-10-23T22:00:00.000Z", "2026-10-25T23:00:00.000Z", "24/10/2026", "26/10/2026"],
])("holiday request/save/email preserves local days %s to %s", async (from, to, fromIso, toIso, fromLabel, toLabel) => {
  const res = await post("ferie", { startDate: from, endDate: to, note: "Vacanza" });
  expect(res.status).toBe(201); await flush();
  expect(res.body.leave.startDate).toBe(fromIso); expect(res.body.leave.endDate).toBe(toIso);
  expect(LeaveRequest.create).toHaveBeenCalledWith(expect.objectContaining({ startDate: new Date(fromIso), endDate: new Date(toIso), date: new Date(fromIso) }));
  const mail = sendEmail.mock.calls[0][0];
  expect(mail.to).toEqual(["admin@example.test"]);
  expect(mail.text).toContain(`dal ${fromLabel} al ${toLabel}`);
});
test("single-day legacy date request has the same saved day and email", async () => {
  const res = await post("ferie", { date: "2026-07-15" }); await flush();
  expect(res.status).toBe(201); expect(res.body.leave.date).toBe("2026-07-14T22:00:00.000Z");
  expect(sendEmail.mock.calls[0][0].text).toContain("15/07/2026");
});
test.each([
  { startDate: "2026-02-30", endDate: "2026-03-01" },
  { startDate: "2026-07-20", endDate: "2026-07-15" },
  { startDate: "invalid" },
])("invalid holiday range is rejected before saving or notifying %j", async body => {
  expect((await post("ferie", body)).status).toBe(400);
  expect(LeaveRequest.create).not.toHaveBeenCalled(); expect(sendEmail).not.toHaveBeenCalled();
});
test.each([
  ["2026-07-14T22:30:00Z", "2026-07-14T22:00:00.000Z", "15/07/2026"],
  ["2026-01-14T23:30:00Z", "2026-01-14T23:00:00.000Z", "15/01/2026"],
])("sickness notifies configured recipients with the Rome day, not UTC: %s", async (now, day, label) => {
  jest.setSystemTime(new Date(now));
  const res = await post("mutua", { note: "Malattia" }); await flush();
  expect(res.status).toBe(201); expect(res.body.leave.status).toBe("approved"); expect(res.body.leave.date).toBe(day);
  const mail = sendEmail.mock.calls[0][0];
  expect(mail.to).toEqual(["admin@example.test"]); expect(mail.subject).toContain("Malattia");
  expect(mail.text).toContain("mario"); expect(mail.text).toContain(label); expect(mail.text).toContain("Stato: Approvata");
  expect(mail.text).not.toContain("per approvare o rifiutare");
});
test.each([
  ["2026-03-29", "2026-03-28T23:00:00.000Z", "2026-03-29T22:00:00.000Z", 23],
  ["2026-10-25", "2026-10-24T22:00:00.000Z", "2026-10-25T23:00:00.000Z", 25],
])("day query boundaries honor DST: %s", (day, from, to, hours) => {
  const range = getDayRangeInAppTz(day);
  expect(range.start.toISOString()).toBe(from); expect(range.nextDayStart.toISOString()).toBe(to);
  expect((range.nextDayStart - range.start) / 3600000).toBe(hours);
});

test.each(["UTC", "Pacific/Honolulu"])("email dates are independent of the server timezone %s", TZ => {
  const { spawnSync } = require("child_process");
  const path = require("path");
  const result = spawnSync(process.execPath, ["-e", 'const { getLeavePeriodLabel } = require(process.argv[1]); console.log(getLeavePeriodLabel({startDate:"2026-07-14T22:00:00Z",endDate:"2026-07-15T22:00:00Z"}));', path.resolve(__dirname, "../../controllers/leaveController.js")], { env: { ...process.env, TZ }, encoding: "utf8", timeout: 10000 });
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe("dal 15/07/2026 al 16/07/2026");
});
