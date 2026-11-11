import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { getClosedWorkSummary } from "../src/utils/workSummary.js";
const require = createRequire(import.meta.url);
const { withWorkDuration } = require("../../backend/utils/workDuration.js");

test("Home User totals use the same net API values as history and admin without subtracting breaks twice", () => {
  const record = { clockIn: "2026-11-10T08:00:00Z", clockOut: "2026-11-10T17:00:00Z", status: "closed", durationSec: 32400,
    breaks: [{ startAt: "2026-11-10T10:00:00Z", endAt: "2026-11-10T10:15:00Z" }, { startAt: "2026-11-10T12:00:00Z", endAt: "2026-11-10T13:00:00Z" }] };
  const normalized = withWorkDuration(record);
  assert.deepEqual(getClosedWorkSummary([normalized]), { durationSec: 27900, breakSec: 4500 });
  assert.equal(record.durationSec, 32400);
});
test("sums several closed sessions, excluding open and cancelled sessions", () => {
  const records = [
    { clockOut: "2026-11-10T12:00:00Z", durationSec: 13500, breakSec: 900 },
    { clockOut: "2026-11-10T17:00:00Z", durationSec: 14400, breakSec: 3600 },
    { clockOut: null, durationSec: 3600, breakSec: 600 },
    { clockOut: "2026-11-10T18:00:00Z", status: "cancelled", durationSec: 3600, breakSec: 600 },
  ];
  assert.deepEqual(getClosedWorkSummary(records), { durationSec: 27900, breakSec: 4500 });
});
test("empty and legacy responses do not produce NaN totals", () => {
  assert.deepEqual(getClosedWorkSummary(), { durationSec: 0, breakSec: 0 });
  assert.deepEqual(getClosedWorkSummary([{ clockOut: "2026-11-10T12:00:00Z" }]), { durationSec: 0, breakSec: 0 });
});
