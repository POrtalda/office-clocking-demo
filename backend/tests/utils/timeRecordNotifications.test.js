jest.mock("../../models/AppSettings", () => ({ findOne: jest.fn() }));
jest.mock("../../models/User", () => ({ findById: jest.fn() }));
jest.mock("../../utils/email", () => ({ sendEmail: jest.fn() }));
const AppSettings = require("../../models/AppSettings");
const User = require("../../models/User");
const { sendEmail } = require("../../utils/email");
const { notifyTimeRecord } = require("../../utils/timeRecordNotifications");
beforeEach(() => {
  jest.clearAllMocks();
  AppSettings.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ leaveNotificationEmails: ["admin@example.test", "hr@example.test"] }) });
  User.findById.mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue({ username: "mario", fullName: "Mario Demo" }) });
  sendEmail.mockResolvedValue({ skipped: false });
});
test.each(["entrata", "uscita"])("sends offsite %s notification to configured recipients with correct Rome time", async action => {
  await notifyTimeRecord({ userId: "employee", mode: "offsite", reason: "Visita cliente", action, at: new Date("2026-07-14T22:30:00Z") });
  expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: ["admin@example.test", "hr@example.test"], subject: expect.stringContaining("Timbratura fuori sede"), text: expect.stringContaining("15/07/2026 00:30") }));
  const { text } = sendEmail.mock.calls[0][0];
  expect(text).toContain("Mario Demo"); expect(text).toContain(action); expect(text).toContain("Visita cliente");
});
test("does not send when no recipients are configured", async () => {
  AppSettings.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ leaveNotificationEmails: [] }) });
  await notifyTimeRecord({ userId: "employee", mode: "offsite" });
  expect(sendEmail).not.toHaveBeenCalled();
});
test("notification failure does not fail the saved stamping operation", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  sendEmail.mockRejectedValueOnce(new Error("SMTP unavailable"));
  await expect(notifyTimeRecord({ userId: "employee", mode: "offsite", reason: "Cliente", at: new Date() })).resolves.toBeUndefined();
  log.mockRestore();
});
