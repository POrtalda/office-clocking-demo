const { calculateWorkDuration, withWorkDuration } = require("../../utils/workDuration");
const at = time => `2026-11-10T${time}:00.000Z`;
const session = { clockIn: at("08:00"), clockOut: at("17:00"), durationSec: 32400 };
const pauses = [
  { startAt: at("10:00"), endAt: at("10:15") },
  { startAt: at("12:00"), endAt: at("13:00") },
];

test("subtracts every completed break, even when unsorted, without mutating data", () => {
  const record = { ...session, breaks: [...pauses].reverse() };
  const before = JSON.stringify(record);
  expect(calculateWorkDuration(record)).toEqual({ durationSec: 27900, breakSec: 4500, beforeBreakSec: 7200, afterBreakSec: 20700 });
  expect(withWorkDuration(record)).toMatchObject({ durationSec: 27900, breakSec: 4500 });
  expect(JSON.stringify(record)).toBe(before);
});
test("keeps legacy records with no breaks compatible", () => {
  expect(withWorkDuration(session).durationSec).toBe(32400);
  expect(withWorkDuration({ ...session, durationSec: null }).durationSec).toBe(32400);
  expect(calculateWorkDuration(session).breakSec).toBe(0);
});
test("open sessions do not enter closed work totals", () => {
  expect(withWorkDuration({ ...session, clockOut: null, breaks: pauses })).toMatchObject({ durationSec: 0, breakSec: 4500 });
});
test("cancelled sessions contribute zero while retaining break audit details", () => {
  expect(withWorkDuration({ ...session, status: "cancelled", breaks: pauses })).toMatchObject({ durationSec: 0, breakSec: 4500 });
});
test("an unfinished break is elapsed through an explicit closing time", () => {
  expect(calculateWorkDuration({ ...session, breaks: [{ startAt: at("12:00") }] })).toMatchObject({ durationSec: 14400, breakSec: 18000 });
});
test.each([
  [{ startAt: at("07:00"), endAt: at("09:00") }],
  [{ startAt: at("16:00"), endAt: at("18:00") }],
  [{ startAt: at("12:00"), endAt: at("11:00") }],
  [{ startAt: "invalid", endAt: at("13:00") }],
  [pauses[0], { startAt: at("10:10"), endAt: at("10:20") }],
])("rejects inconsistent break intervals: %j", (...breaks) => {
  expect(() => calculateWorkDuration({ ...session, breaks })).toThrow();
});
test.each(["invalid", at("07:00")])("rejects invalid closing times %s", clockOut => {
  expect(() => calculateWorkDuration({ ...session, clockOut })).toThrow();
});
test("supports overnight shifts and zero net time", () => {
  const record = { clockIn: "2026-11-10T23:00:00Z", clockOut: "2026-11-11T02:00:00Z", breaks: [{ startAt: "2026-11-11T00:00:00Z", endAt: "2026-11-11T00:30:00Z" }] };
  expect(calculateWorkDuration(record).durationSec).toBe(9000);
  expect(calculateWorkDuration({ ...session, breaks: [{ startAt: session.clockIn, endAt: session.clockOut }] }).durationSec).toBe(0);
});
