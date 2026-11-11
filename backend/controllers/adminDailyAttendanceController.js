const User = require("../models/User");
const TimeRecord = require("../models/TimeRecord");
const LeaveRequest = require("../models/LeaveRequest");
const AppError = require("../utils/AppError");
const { validateSingleDate } = require("../utils/validators");
const { dayjs, APP_TZ, getDayRangeInAppTz, formatDateInAppTz } = require("../utils/dateTime");

function coversDay(leave, date) {
  const from = formatDateInAppTz(leave.startDate || leave.date);
  const to = formatDateInAppTz(leave.endDate || leave.date);
  return Boolean(from && to && from <= date && date <= to);
}

async function getDailyAttendance(req, res, next) {
  try {
    const now = dayjs().tz(APP_TZ);
    const today = now.format("YYYY-MM-DD");
    const date = req.query.date === undefined ? today : req.query.date;
    const validation = typeof date === "string" ? validateSingleDate(date) : { ok: false, message: "Data non valida" };
    if (!validation.ok) return next(new AppError(validation.message, 400, "INVALID_DATE"));
    const { start, nextDayStart } = getDayRangeInAppTz(date);
    const employees = await User.find({ role: "user", isActive: { $ne: false } })
      .select("_id username fullName")
      .sort({ username: 1 })
      .lean();
    const ids = employees.map((employee) => employee._id);
    const [records, leaves] = ids.length ? await Promise.all([
      TimeRecord.find({ user: { $in: ids }, clockIn: { $gte: start, $lt: nextDayStart }, status: { $ne: "cancelled" } })
        .select("user clockIn status")
        .sort({ clockIn: 1 })
        .lean(),
      LeaveRequest.find({
        user: { $in: ids },
        status: "approved",
        type: { $in: ["mutua", "ferie", "pir"] },
        $or: [
          { startDate: { $lt: nextDayStart }, endDate: { $gte: start } },
          { date: { $gte: start, $lt: nextDayStart } },
        ],
      }).select("user type date startDate endDate hours startTime endTime").lean(),
    ]) : [[], []];

    const firstIns = new Map();
    for (const record of records) {
      const key = String(record.user);
      if (!firstIns.has(key) || new Date(record.clockIn) < new Date(firstIns.get(key))) {
        firstIns.set(key, record.clockIn);
      }
    }
    const absenceByUser = new Map();
    const priority = { mutua: 3, ferie: 2, pir: 1 };
    for (const leave of leaves) {
      if (leave.type === "pir" && leave.hours != null) continue;
      if (!coversDay(leave, date)) continue;
      const key = String(leave.user);
      const previous = absenceByUser.get(key);
      if (!previous || priority[leave.type] > priority[previous]) absenceByUser.set(key, leave.type);
    }

    const entered = [];
    const missing = [];
    const absent = [];
    for (const employee of employees) {
      const key = String(employee._id);
      const person = { userId: key, username: employee.username, fullName: employee.fullName || "" };
      if (firstIns.has(key)) {
        entered.push({ ...person, firstClockIn: firstIns.get(key) });
      } else if (absenceByUser.has(key)) {
        absent.push({ ...person, type: absenceByUser.get(key) });
      } else {
        missing.push(person);
      }
    }

    return res.json({
      date,
      timezone: APP_TZ,
      checkedAt: now.toISOString(),
      checkTime: "09:00",
      checkReached: date < today || (date === today && now.hour() >= 9),
      isToday: date === today,
      counts: { total: employees.length, entered: entered.length, missing: missing.length, absent: absent.length },
      entered, missing, absent,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getDailyAttendance };