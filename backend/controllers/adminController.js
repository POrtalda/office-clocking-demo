/**
 * controllers/adminController.js
 *
 * Logica delle rotte riservate agli admin.
 *
 * Questo controller gestisce:
 * - test accesso admin
 * - lista utenti
 * - creazione utente lato admin
 * - attivazione/disattivazione utenti
 * - reset password utenti
 * - cancellazione sicura utenti
 * - dashboard riepilogativa
 * - dettaglio giornaliero utente
 * - export CSV
 * - riepilogo singolo utente
 * - riepilogo multiutente
 * - gestione richieste di chiusura manuale
 * - lettura leave/assenze di un utente
 * - gestione richieste leave pending
 */

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User.js");
const TimeRecord = require("../models/TimeRecord.js");
const LeaveRequest = require("../models/LeaveRequest");
const AppSettings = require("../models/AppSettings");
const AppError = require("../utils/AppError");

const {
  dayjs,
  APP_TZ,
  getDayRangeInAppTz,
  getRangeFromToInAppTz,
  formatDateInAppTz,
  secToHHMMSS,
} = require("../utils/dateTime");

const {
  MAX_RANGE_DAYS,
  normalizeUsername,
  validateDateRange,
  validateSingleDate,
} = require("../utils/validators");

const {
  MAX_MANUAL_CLOSURE_HOURS,
  MAX_MANUAL_CLOSURE_SECONDS,
} = require("../utils/businessRules");

// ============================================================================
// HELPERS LOCALI
// ============================================================================

const APPROVED_LEAVES_MAX_RANGE_DAYS = 366;

function escapeCsv(value) {
  const s = String(value ?? "");
  if (/[;"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function calcDurationSec(clockIn, clockOut) {
  const startMs = new Date(clockIn).getTime();
  const endMs = new Date(clockOut).getTime();
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

function hasManualClosureRequest(record) {
  return Boolean(
    record?.manualClosureRequest &&
    (
      record.manualClosureRequest.proposedClockOut ||
      record.manualClosureRequest.requestedAt ||
      record.manualClosureRequest.reviewedAt ||
      record.manualClosureRequest.reviewedBy ||
      record.manualClosureRequest.reviewNote
    )
  );
}

function hasManualClosureBeenReviewed(record) {
  return Boolean(record?.manualClosureRequest?.reviewedAt);
}

function getEffectiveStatus(record) {
  const rawStatus = String(record?.status || "").trim().toLowerCase();

  if (rawStatus === "cancelled") {
    return "cancelled";
  }

  if (record?.clockOut) return "closed";

  if (
    rawStatus === "closed" ||
    rawStatus === "open" ||
    rawStatus === "pending_manual_closure" ||
    rawStatus === "manual_closure_rejected"
  ) {
    return rawStatus;
  }

  const hasManualRequest = hasManualClosureRequest(record);
  const reviewed = hasManualClosureBeenReviewed(record);

  if (hasManualRequest && reviewed) return "manual_closure_rejected";
  if (hasManualRequest && !reviewed) return "pending_manual_closure";

  return "open";
}

function isEffectivelyClosedRecord(record) {
  return getEffectiveStatus(record) === "closed";
}

function getEffectiveDurationSec(record) {
  if (getEffectiveStatus(record) === "cancelled") {
    return 0;
  }
  if (
    typeof record?.durationSec === "number" &&
    Number.isFinite(record.durationSec) &&
    record.durationSec >= 0
  ) {
    return record.durationSec;
  }

  if (record?.clockIn && record?.clockOut) {
    return calcDurationSec(record.clockIn, record.clockOut);
  }

  return 0;
}

function getAdminStatusLabel(record) {
  const status = getEffectiveStatus(record);

  if (status === "cancelled") return "ANNULLATA";
  if (status === "closed") return "CHIUSO";
  if (status === "open") return "APERTO";
  if (status === "pending_manual_closure") return "IN ATTESA APPROVAZIONE";
  if (status === "manual_closure_rejected") return "RICHIESTA RIFIUTATA";

  return "SCONOSCIUTO";
}

function decorateRecordForAdmin(record) {
  const effectiveStatus = getEffectiveStatus(record);
  const effectiveDurationSec = getEffectiveDurationSec(record);

  return {
    ...record,
    effectiveStatus,
    effectiveStatusLabel: getAdminStatusLabel(record),
    effectiveDurationSec,
    effectiveDurationHHMMSS: secToHHMMSS(effectiveDurationSec),
  };
}

function decorateLeaveForAdmin(leave) {
  return {
    ...leave,
    dateLabel: leave?.date ? formatDateInAppTz(leave.date) : "",
    typeLabel:
      leave?.type === "mutua"
        ? "MUTUA"
        : leave?.type === "ferie"
          ? "FERIE"
          : leave?.type === "pir"
            ? "PIR"
            : String(leave?.type || "").toUpperCase(),
    statusLabel:
      leave?.status === "approved"
        ? "APPROVATA"
        : leave?.status === "pending"
          ? "IN ATTESA"
          : leave?.status === "rejected"
            ? "RIFIUTATA"
            : leave?.status === "cancelled"
              ? "ANNULLATA"
              : String(leave?.status || "").toUpperCase(),
  };
}

function getLeaveDaysInRange(leave, rangeStart, rangeEndExclusive) {
  const leaveStartSource = leave?.startDate || leave?.date;
  const leaveEndSource = leave?.endDate || leave?.date;

  if (!leaveStartSource || !leaveEndSource) {
    return [];
  }

  const rangeStartDay = dayjs(rangeStart).tz(APP_TZ).startOf("day");
  const rangeEndDay = dayjs(rangeEndExclusive)
    .tz(APP_TZ)
    .subtract(1, "millisecond")
    .startOf("day");

  let currentDay = dayjs(leaveStartSource).tz(APP_TZ).startOf("day");
  const leaveEndDay = dayjs(leaveEndSource).tz(APP_TZ).startOf("day");

  if (currentDay.isBefore(rangeStartDay)) {
    currentDay = rangeStartDay;
  }

  const lastDay = leaveEndDay.isAfter(rangeEndDay) ? rangeEndDay : leaveEndDay;

  const days = [];

  while (currentDay.isSame(lastDay) || currentDay.isBefore(lastDay)) {
    days.push(currentDay.format("YYYY-MM-DD"));
    currentDay = currentDay.add(1, "day");
  }

  return days;
}

function toAdminUserResponse(userDoc) {
  return {
    id: userDoc._id,
    username: userDoc.username,
    role: userDoc.role,
    isActive: userDoc.isActive,
    geolocationEnabled: userDoc.geolocationEnabled !== false,
    fullName: userDoc.fullName || "",
    email: userDoc.email || "",
    createdAt: userDoc.createdAt,
    updatedAt: userDoc.updatedAt,
  };
}

// ============================================================================
// CONTROLLER ADMIN
// ============================================================================

async function adminOnly(req, res, next) {
  try {
    return res.json({
      message: "Solo admin",
      user: req.user,
    });
  } catch (err) {
    next(err);
  }
}

async function getUsers(req, res, next) {
  try {
    const users = await User.find({})
      .select("_id username role isActive geolocationEnabled fullName email createdAt updatedAt")
      .sort({ username: 1 })
      .lean();

    return res.json({ users });
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const rawUsername = req.body?.username;
    const rawPassword = req.body?.password;
    const rawRole = req.body?.role;
    const rawFullName = req.body?.fullName;
    const rawEmail = req.body?.email;

    if (!rawUsername || !rawPassword) {
      return next(
        new AppError(
          "Username e password sono obbligatori",
          400,
          "MISSING_REQUIRED_FIELDS"
        )
      );
    }

    const username = normalizeUsername(rawUsername);
    const password = String(rawPassword);
    const role = String(rawRole || "user").trim().toLowerCase();
    const fullName = String(rawFullName || "").trim();
    const email = String(rawEmail || "").trim().toLowerCase();

    if (!username) {
      return next(
        new AppError("Username non valido", 400, "INVALID_USERNAME")
      );
    }

    if (password.length < 4) {
      return next(
        new AppError(
          "La password deve contenere almeno 4 caratteri",
          400,
          "PASSWORD_TOO_SHORT"
        )
      );
    }

    if (role !== "admin" && role !== "user") {
      return next(
        new AppError(
          "Ruolo non valido. Valori ammessi: admin, user",
          400,
          "INVALID_ROLE"
        )
      );
    }

    const existingUser = await User.findOne({ username }).lean();

    if (existingUser) {
      return next(
        new AppError(
          "Username già esistente",
          409,
          "USERNAME_ALREADY_EXISTS"
        )
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      username,
      password: hashedPassword,
      role,
      isActive: true,
      geolocationEnabled: true,
      fullName,
      email,
    });

    return res.status(201).json({
      message: "Utente creato con successo",
      user: toAdminUserResponse(newUser),
    });
  } catch (err) {
    next(err);
  }
}

async function updateUserStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { isActive } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(
        new AppError("ID utente non valido", 400, "INVALID_USER_ID")
      );
    }

    if (typeof isActive !== "boolean") {
      return next(
        new AppError(
          "Il campo isActive è obbligatorio e deve essere booleano",
          400,
          "INVALID_IS_ACTIVE"
        )
      );
    }

    if (String(req.user.id) === String(id) && isActive === false) {
      return next(
        new AppError(
          "Non puoi disattivare il tuo stesso account admin",
          400,
          "CANNOT_DISABLE_SELF"
        )
      );
    }

    const userToUpdate = await User.findById(id);

    if (!userToUpdate) {
      return next(new AppError("Utente non trovato", 404, "USER_NOT_FOUND"));
    }

    userToUpdate.isActive = isActive;
    await userToUpdate.save();

    return res.status(200).json({
      message: `Utente ${isActive ? "attivato" : "disattivato"} con successo`,
      user: toAdminUserResponse(userToUpdate),
    });
  } catch (err) {
    next(err);
  }
}

async function updateUserGeolocationStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { geolocationEnabled } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(
        new AppError("ID utente non valido", 400, "INVALID_USER_ID")
      );
    }

    if (typeof geolocationEnabled !== "boolean") {
      return next(
        new AppError(
          "Il campo geolocationEnabled è obbligatorio e deve essere booleano",
          400,
          "INVALID_GEOLOCATION_ENABLED"
        )
      );
    }

    const userToUpdate = await User.findById(id);

    if (!userToUpdate) {
      return next(new AppError("Utente non trovato", 404, "USER_NOT_FOUND"));
    }

    userToUpdate.geolocationEnabled = geolocationEnabled;
    await userToUpdate.save();

    return res.status(200).json({
      message: `Geolocalizzazione ${geolocationEnabled ? "attivata" : "disattivata"
        } per l'utente`,
      user: toAdminUserResponse(userToUpdate),
    });
  } catch (err) {
    next(err);
  }
}

async function updateUserPassword(req, res, next) {
  try {
    const { id } = req.params;
    const rawPassword = req.body?.password;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(
        new AppError("ID utente non valido", 400, "INVALID_USER_ID")
      );
    }

    if (!rawPassword) {
      return next(
        new AppError("La password è obbligatoria", 400, "MISSING_PASSWORD")
      );
    }

    const password = String(rawPassword);

    if (password.length < 4) {
      return next(
        new AppError(
          "La password deve contenere almeno 4 caratteri",
          400,
          "PASSWORD_TOO_SHORT"
        )
      );
    }

    const userToUpdate = await User.findById(id);

    if (!userToUpdate) {
      return next(new AppError("Utente non trovato", 404, "USER_NOT_FOUND"));
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    userToUpdate.password = hashedPassword;
    await userToUpdate.save();

    return res.status(200).json({
      message: "Password aggiornata con successo",
      user: toAdminUserResponse(userToUpdate),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Cancellazione sicura utente.
 *
 * Regole:
 * - admin non può cancellare sé stesso
 * - utente cancellabile solo se non ha timbrature collegate
 */
async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(
        new AppError("ID utente non valido", 400, "INVALID_USER_ID")
      );
    }

    if (String(req.user.id) === String(id)) {
      return next(
        new AppError(
          "Non puoi cancellare il tuo stesso account admin",
          400,
          "CANNOT_DELETE_SELF"
        )
      );
    }

    const userToDelete = await User.findById(id);

    if (!userToDelete) {
      return next(new AppError("Utente non trovato", 404, "USER_NOT_FOUND"));
    }

    const existingRecord = await TimeRecord.findOne({ user: userToDelete._id })
      .select("_id")
      .lean();

    if (existingRecord) {
      return next(
        new AppError(
          "Impossibile cancellare l'utente: sono presenti timbrature collegate. Disattivalo invece di eliminarlo.",
          400,
          "USER_HAS_TIME_RECORDS"
        )
      );
    }

    await User.findByIdAndDelete(userToDelete._id);

    return res.status(200).json({
      message: "Utente cancellato con successo",
      user: toAdminUserResponse(userToDelete),
    });
  } catch (err) {
    next(err);
  }
}

async function getDashboard(req, res, next) {
  try {
    const employees = await User.find({ role: "user", isActive: true })
      .select("_id username role")
      .lean();

    const nowRome = dayjs().tz(APP_TZ);
    const todayStr = nowRome.format("YYYY-MM-DD");
    const yesterdayStr = nowRome.subtract(1, "day").format("YYYY-MM-DD");

    const { start: todayStart, nextDayStart: todayNextStart } =
      getDayRangeInAppTz(todayStr);

    const { start: yStart, nextDayStart: yNextStart } =
      getDayRangeInAppTz(yesterdayStr);

    const todayFirstIns = await TimeRecord.aggregate([
      {
        $match: {
          clockIn: {
            $gte: todayStart,
            $lt: todayNextStart,
          },
        },
      },
      { $sort: { clockIn: 1 } },
      {
        $group: {
          _id: "$user",
          firstClockIn: { $first: "$clockIn" },
        },
      },
    ]);

    const todayMap = new Map(
      todayFirstIns.map((item) => [String(item._id), item.firstClockIn])
    );

    const missingClockInToday = [];
    const lateYellow = [];
    const lateRed = [];

    const yellowThreshold = 9 * 60 + 15;
    const redThreshold = 9 * 60 + 30;

    for (const employee of employees) {
      const firstIn = todayMap.get(String(employee._id));

      if (!firstIn) {
        missingClockInToday.push(employee.username);
        continue;
      }

      const localTime = dayjs(firstIn).tz(APP_TZ);
      const minutesFromMidnight = localTime.hour() * 60 + localTime.minute();

      if (minutesFromMidnight > redThreshold) {
        lateRed.push({
          username: employee.username,
          time: firstIn,
        });
      } else if (minutesFromMidnight > yellowThreshold) {
        lateYellow.push({
          username: employee.username,
          time: firstIn,
        });
      }
    }

    const yesterdayOuts = await TimeRecord.aggregate([
      {
        $match: {
          clockOut: {
            $ne: null,
            $gte: yStart,
            $lt: yNextStart,
          },
        },
      },
      {
        $group: {
          _id: "$user",
        },
      },
    ]);

    const yesterdayOutSet = new Set(
      yesterdayOuts.map((item) => String(item._id))
    );

    const missingClockOutYesterday = employees
      .filter((employee) => !yesterdayOutSet.has(String(employee._id)))
      .map((employee) => employee.username);

    const trafficLight =
      lateRed.length > 0 ? "red" : lateYellow.length > 0 ? "yellow" : "green";

    return res.json({
      today: {
        date: todayStr,
        start: todayStart,
        nextDayStart: todayNextStart,
        timezone: APP_TZ,
      },
      yesterday: {
        date: yesterdayStr,
        start: yStart,
        nextDayStart: yNextStart,
        timezone: APP_TZ,
      },
      employees: employees.map((employee) => ({
        username: employee.username,
      })),
      counts: {
        employees: employees.length,
        missingClockInToday: missingClockInToday.length,
        missingClockOutYesterday: missingClockOutYesterday.length,
        lateYellow: lateYellow.length,
        lateRed: lateRed.length,
      },
      trafficLight,
      missingClockInToday,
      missingClockOutYesterday,
      late: {
        yellow: lateYellow,
        red: lateRed,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getUserRecordsByDay(req, res, next) {
  try {
    const { username, date } = req.query;

    if (!username || !date) {
      return next(
        new AppError(
          "Parametri richiesti: username e date",
          400,
          "MISSING_REQUIRED_PARAMS"
        )
      );
    }

    const singleDateValidation = validateSingleDate(date, "date");
    if (!singleDateValidation.ok) {
      return next(
        new AppError(singleDateValidation.message, 400, "INVALID_DATE")
      );
    }

    const userDoc = await User.findOne({
      username: normalizeUsername(username),
    }).lean();

    if (!userDoc) {
      return next(new AppError("Utente non trovato", 404, "USER_NOT_FOUND"));
    }

    const { start, nextDayStart } = getDayRangeInAppTz(date);

    const rawRecords = await TimeRecord.find({
      user: userDoc._id,
      clockIn: {
        $gte: start,
        $lt: nextDayStart,
      },
    })
      .sort({ clockIn: 1 })
      .lean();

    const records = rawRecords.map(decorateRecordForAdmin);

    const totalSec = records.reduce((sum, record) => {
      if (!isEffectivelyClosedRecord(record)) return sum;
      return sum + record.effectiveDurationSec;
    }, 0);

    return res.json({
      user: {
        username: userDoc.username,
        role: userDoc.role,
        isActive: userDoc.isActive,
        fullName: userDoc.fullName || "",
        email: userDoc.email || "",
      },
      date,
      timezone: APP_TZ,
      totalRecords: records.length,
      closedRecords: records.filter(isEffectivelyClosedRecord).length,
      totalSec,
      totalHHMMSS: secToHHMMSS(totalSec),
      records,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Leave / assenze di un utente lette dall'admin.
 *
 * Supporta:
 * - ?username=mario&date=YYYY-MM-DD
 * - ?username=mario&from=YYYY-MM-DD&to=YYYY-MM-DD
 */
async function getUserLeaves(req, res, next) {
  try {
    const { username, date, from, to } = req.query;

    if (!username) {
      return next(
        new AppError(
          "Parametro richiesto: username",
          400,
          "MISSING_REQUIRED_PARAMS"
        )
      );
    }

    const userDoc = await User.findOne({
      username: normalizeUsername(username),
    }).lean();

    if (!userDoc) {
      return next(new AppError("Utente non trovato", 404, "USER_NOT_FOUND"));
    }

    const query = {
      user: userDoc._id,
    };

    if (date) {
      const singleDateValidation = validateSingleDate(date, "date");
      if (!singleDateValidation.ok) {
        return next(
          new AppError(singleDateValidation.message, 400, "INVALID_DATE")
        );
      }

      const { start, nextDayStart } = getDayRangeInAppTz(date);

      query.$or = [
        {
          startDate: { $lt: nextDayStart },
          endDate: { $gte: start },
        },
        {
          date: {
            $gte: start,
            $lt: nextDayStart,
          },
        },
      ];
    } else if (from || to) {
      const rangeValidation = validateDateRange(from, to, MAX_RANGE_DAYS);
      if (!rangeValidation.ok) {
        return next(
          new AppError(rangeValidation.message, 400, "INVALID_DATE_RANGE")
        );
      }

      const { start, nextDayStart } = getRangeFromToInAppTz(from, to);

      query.$or = [
        {
          startDate: { $lt: nextDayStart },
          endDate: { $gte: start },
        },
        {
          date: {
            $gte: start,
            $lt: nextDayStart,
          },
        },
      ];
    }

    const rawLeaves = await LeaveRequest.find(query)
      .sort({ startDate: 1, date: 1, createdAt: 1 })
      .populate("reviewedBy", "username role")
      .lean();

    const leaves = rawLeaves.map(decorateLeaveForAdmin);

    return res.json({
      user: {
        username: userDoc.username,
        role: userDoc.role,
        isActive: userDoc.isActive,
        fullName: userDoc.fullName || "",
        email: userDoc.email || "",
      },
      filters: {
        username: userDoc.username,
        date: date || "",
        from: from || "",
        to: to || "",
      },
      timezone: APP_TZ,
      totalLeaves: leaves.length,
      leaves,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Riepilogo ferie/PIR approvati.
 *
 * Supporta:
 * - ?from=YYYY-MM-DD&to=YYYY-MM-DD
 * - ?username=mario
 * - ?type=ferie|pir
 */
async function getApprovedLeavesSummary(req, res, next) {
  try {
    const { from, to, username, type } = req.query;

    const rangeValidation = validateDateRange(
      from,
      to,
      APPROVED_LEAVES_MAX_RANGE_DAYS
    );
    if (!rangeValidation.ok) {
      return next(
        new AppError(rangeValidation.message, 400, "INVALID_DATE_RANGE")
      );
    }

    const normalizedType = String(type || "").trim().toLowerCase();

    if (normalizedType && normalizedType !== "ferie" && normalizedType !== "pir") {
      return next(
        new AppError(
          "Tipo assenza non valido. Valori ammessi: ferie, pir",
          400,
          "INVALID_LEAVE_TYPE"
        )
      );
    }

    const { start, nextDayStart } = getRangeFromToInAppTz(from, to);

    const query = {
      status: "approved",
      type: normalizedType ? normalizedType : { $in: ["ferie", "pir"] },
      $or: [
        {
          startDate: { $lt: nextDayStart },
          endDate: { $gte: start },
        },
        {
          date: {
            $gte: start,
            $lt: nextDayStart,
          },
        },
      ],
    };

    let selectedUserDoc = null;

    if (username) {
      selectedUserDoc = await User.findOne({
        username: normalizeUsername(username),
      }).lean();

      if (!selectedUserDoc) {
        return next(new AppError("Utente non trovato", 404, "USER_NOT_FOUND"));
      }

      query.user = selectedUserDoc._id;
    }

    const rawLeaves = await LeaveRequest.find(query)
      .populate("user", "username role fullName email isActive")
      .populate("reviewedBy", "username role")
      .sort({ startDate: 1, date: 1, createdAt: 1 })
      .lean();

    const leaves = rawLeaves.map((leave) => ({
      ...decorateLeaveForAdmin(leave),
      username: leave.user?.username || "",
      fullName: leave.user?.fullName || "",
      email: leave.user?.email || "",
      userRole: leave.user?.role || "",
      userIsActive: leave.user?.isActive ?? true,
    }));

    return res.json({
      from,
      to,
      username: selectedUserDoc?.username || "",
      type: normalizedType || "",
      timezone: APP_TZ,
      total: leaves.length,
      leaves,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Lista richieste leave in pending per revisione admin.
 */
async function getLeaveRequests(req, res, next) {
  try {
    const rawLeaves = await LeaveRequest.find({
      status: "pending",
    })
      .populate("user", "username role fullName email isActive")
      .sort({ date: 1, createdAt: 1 })
      .lean();

    const leaves = rawLeaves.map((leave) => ({
      ...decorateLeaveForAdmin(leave),
      username: leave.user?.username || "",
      fullName: leave.user?.fullName || "",
      email: leave.user?.email || "",
      userRole: leave.user?.role || "",
      userIsActive: leave.user?.isActive ?? true,
    }));

    return res.json({
      total: leaves.length,
      leaves,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Approva una richiesta leave pending.
 */
async function approveLeaveRequest(req, res, next) {
  try {
    const { leaveId } = req.params;
    const reviewNote = String(req.body?.reviewNote || "").trim();

    if (!mongoose.Types.ObjectId.isValid(leaveId)) {
      return next(
        new AppError("ID leave non valido", 400, "INVALID_LEAVE_ID")
      );
    }

    const leave = await LeaveRequest.findById(leaveId);

    if (!leave) {
      return next(new AppError("Leave non trovata", 404, "LEAVE_NOT_FOUND"));
    }

    if (leave.status !== "pending") {
      return next(
        new AppError(
          "La richiesta leave non è in attesa di approvazione",
          400,
          "INVALID_LEAVE_STATUS"
        )
      );
    }

    const leaveStartSource = leave.startDate || leave.date;
    const leaveEndSource = leave.endDate || leave.date;

    const leaveStartDay = formatDateInAppTz(leaveStartSource);
    const leaveEndDay = formatDateInAppTz(leaveEndSource);

    const start = dayjs.tz(leaveStartDay, APP_TZ).startOf("day").toDate();
    const end = dayjs.tz(leaveEndDay, APP_TZ).endOf("day").toDate();

    const existingApprovedLeave = await LeaveRequest.findOne({
      _id: { $ne: leave._id },
      user: leave.user,
      status: "approved",
      $or: [
        {
          startDate: { $lte: end },
          endDate: { $gte: start },
        },
        {
          date: { $gte: start, $lte: end },
        },
      ],
    });

    if (existingApprovedLeave) {
      return next(
        new AppError(
          "Non puoi approvare questa assenza: esiste gia un'assenza approvata nello stesso giorno.",
          409,
          "APPROVED_LEAVE_ALREADY_PRESENT"
        )
      );
    }

    const isHourlyPir =
      leave.type === "pir" &&
      leave.hours != null &&
      leave.startTime &&
      leave.endTime;

    if (!isHourlyPir) {
      const existingTimeRecord = await TimeRecord.findOne({
        user: leave.user,
        clockIn: { $gte: start, $lte: end },
      });

      if (existingTimeRecord) {
        return next(
          new AppError(
            "Non puoi approvare questa assenza: esiste gia una timbratura nello stesso giorno.",
            409,
            "TIMERECORD_ALREADY_PRESENT"
          )
        );
      }
    }

    leave.status = "approved";
    leave.reviewedAt = new Date();
    leave.reviewedBy = req.user.id;
    leave.reviewNote = reviewNote;

    await leave.save();

    const savedLeave = await LeaveRequest.findById(leave._id)
      .populate("user", "username role fullName email isActive")
      .populate("reviewedBy", "username role")
      .lean();

    return res.json({
      message: "Richiesta assenza approvata",
      leave: decorateLeaveForAdmin(savedLeave),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Rifiuta una richiesta leave pending.
 */
async function rejectLeaveRequest(req, res, next) {
  try {
    const { leaveId } = req.params;
    const reviewNote = String(req.body?.reviewNote || "").trim();

    if (!mongoose.Types.ObjectId.isValid(leaveId)) {
      return next(
        new AppError("ID leave non valido", 400, "INVALID_LEAVE_ID")
      );
    }

    const leave = await LeaveRequest.findById(leaveId);

    if (!leave) {
      return next(new AppError("Leave non trovata", 404, "LEAVE_NOT_FOUND"));
    }

    if (leave.status !== "pending") {
      return next(
        new AppError(
          "La richiesta leave non è in attesa di approvazione",
          400,
          "INVALID_LEAVE_STATUS"
        )
      );
    }

    if ((leave.type === "ferie" || leave.type === "pir") && !reviewNote) {
      return next(
        new AppError(
          "La motivazione del rifiuto è obbligatoria per ferie e PIR",
          400,
          "LEAVE_REJECTION_REASON_REQUIRED"
        )
      );
    }

    leave.status = "rejected";
    leave.reviewedAt = new Date();
    leave.reviewedBy = req.user.id;
    leave.reviewNote = reviewNote || "Richiesta rifiutata dall'admin";

    await leave.save();

    const savedLeave = await LeaveRequest.findById(leave._id)
      .populate("user", "username role fullName email isActive")
      .populate("reviewedBy", "username role")
      .lean();

    return res.json({
      message: "Richiesta assenza rifiutata",
      leave: decorateLeaveForAdmin(savedLeave),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Annulla una richiesta ferie/PIR già approvata.
 */
async function cancelApprovedLeaveRequest(req, res, next) {
  try {
    const { leaveId } = req.params;
    const reviewNote = String(req.body?.reviewNote || "").trim();

    if (!mongoose.Types.ObjectId.isValid(leaveId)) {
      return next(
        new AppError("ID leave non valido", 400, "INVALID_LEAVE_ID")
      );
    }

    if (!reviewNote) {
      return next(
        new AppError(
          "La motivazione dell'annullamento è obbligatoria",
          400,
          "LEAVE_CANCELLATION_REASON_REQUIRED"
        )
      );
    }

    const leave = await LeaveRequest.findById(leaveId);

    if (!leave) {
      return next(new AppError("Leave non trovata", 404, "LEAVE_NOT_FOUND"));
    }

    if (leave.type !== "ferie" && leave.type !== "pir") {
      return next(
        new AppError(
          "Puoi annullare solo richieste ferie o PIR",
          400,
          "INVALID_LEAVE_TYPE"
        )
      );
    }

    if (leave.status !== "approved") {
      return next(
        new AppError(
          "Puoi annullare solo richieste già approvate",
          400,
          "INVALID_LEAVE_STATUS"
        )
      );
    }

    leave.status = "cancelled";
    leave.reviewedAt = new Date();
    leave.reviewedBy = req.user.id;
    leave.reviewNote = reviewNote;

    await leave.save();

    const savedLeave = await LeaveRequest.findById(leave._id)
      .populate("user", "username role fullName email isActive")
      .populate("reviewedBy", "username role")
      .lean();

    return res.json({
      message: "Richiesta assenza annullata",
      leave: decorateLeaveForAdmin(savedLeave),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Annulla logicamente una timbratura errata.
 *
 * Il record non viene cancellato dal database:
 * resta visibile come storico/audit, ma non viene conteggiato
 * nei riepiloghi ore grazie allo status "cancelled".
 */
async function cancelTimeRecord(req, res, next) {
  try {
    const { recordId } = req.params;
    const cancelReason = String(req.body?.cancelReason || "").trim();

    if (!mongoose.Types.ObjectId.isValid(recordId)) {
      return next(
        new AppError("ID timbratura non valido", 400, "INVALID_RECORD_ID")
      );
    }

    if (!cancelReason) {
      return next(
        new AppError(
          "La motivazione dell'annullamento è obbligatoria",
          400,
          "TIMERECORD_CANCELLATION_REASON_REQUIRED"
        )
      );
    }

    const record = await TimeRecord.findById(recordId);

    if (!record) {
      return next(new AppError("Timbratura non trovata", 404, "RECORD_NOT_FOUND"));
    }

    if (record.status === "cancelled") {
      return next(
        new AppError(
          "La timbratura è già stata annullata",
          400,
          "TIMERECORD_ALREADY_CANCELLED"
        )
      );
    }

    record.status = "cancelled";
    record.cancellation.cancelledAt = new Date();
    record.cancellation.cancelledBy = req.user.id;
    record.cancellation.cancelReason = cancelReason;

    await record.save();

    const savedRecord = await TimeRecord.findById(record._id)
      .populate("user", "username role")
      .populate("cancellation.cancelledBy", "username role")
      .populate("manualClosureRequest.reviewedBy", "username role")
      .lean();

    return res.json({
      message: "Timbratura annullata",
      record: decorateRecordForAdmin(savedRecord),
    });
  } catch (err) {
    next(err);
  }
}

async function exportRecordsCsv(req, res, next) {
  try {
    const { from: fromStr, to: toStr, username } = req.query;

    const rangeValidation = validateDateRange(fromStr, toStr, MAX_RANGE_DAYS);
    if (!rangeValidation.ok) {
      return next(
        new AppError(rangeValidation.message, 400, "INVALID_DATE_RANGE")
      );
    }

    const { start, nextDayStart } = getRangeFromToInAppTz(fromStr, toStr);

    let usernameNormalized = "";
    let selectedUserDoc = null;

    if (username) {
      usernameNormalized = normalizeUsername(username);

      selectedUserDoc = await User.findOne({
        username: usernameNormalized,
      }).lean();

      if (!selectedUserDoc) {
        return next(new AppError("Utente non trovato", 404, "USER_NOT_FOUND"));
      }
    }

    const recordQuery = {
      clockIn: {
        $gte: start,
        $lt: nextDayStart,
      },
    };

    const leaveQuery = {
      $or: [
        {
          startDate: { $lt: nextDayStart },
          endDate: { $gte: start },
        },
        {
          date: {
            $gte: start,
            $lt: nextDayStart,
          },
        },
      ],
    };

    if (selectedUserDoc) {
      recordQuery.user = selectedUserDoc._id;
      leaveQuery.user = selectedUserDoc._id;
    }

    const rawRecords = await TimeRecord.find(recordQuery)
      .populate("user", "username role")
      .populate("cancellation.cancelledBy", "username role")
      .sort({ clockIn: 1 })
      .lean();

    const rawLeaves = await LeaveRequest.find(leaveQuery)
      .populate("user", "username role")
      .populate("reviewedBy", "username role")
      .sort({ startDate: 1, date: 1, createdAt: 1 })
      .lean();

    const records = rawRecords.map(decorateRecordForAdmin);
    const leaves = rawLeaves.map(decorateLeaveForAdmin);

    const delimiter = ";";

    const header = [
      "tipoRiga",
      "username",
      "userId",
      "dataLocale",
      "entrataISO",
      "uscitaISO",
      "durataSec",
      "durataHHMMSS",
      "statusOriginale",
      "statusEffettivo",
      "statoLabel",
      "assenzaTipo",
      "assenzaOre",
      "assenzaNote",
      "reviewedBy",
      "reviewedAtISO",
      "reviewNote",
      "cancelledBy",
      "cancelledAtISO",
      "cancelReason",
    ].join(delimiter);

    const recordLines = records.map((record) => {
      const populatedUser = record.user || {};

      const usernameOut = populatedUser.username || "";
      const userIdOut = populatedUser._id
        ? String(populatedUser._id)
        : String(record.user || "");

      const dataLocale = formatDateInAppTz(record.clockIn);

      const entrataISO = record.clockIn
        ? new Date(record.clockIn).toISOString()
        : "";

      const uscitaISO = record.clockOut
        ? new Date(record.clockOut).toISOString()
        : "";

      const durataSec = record.effectiveDurationSec ?? "";
      const durataHHMMSS =
        record.effectiveDurationSec == null
          ? ""
          : secToHHMMSS(record.effectiveDurationSec);

      const statusOriginale = record.status || "";
      const statusEffettivo = record.effectiveStatus || "";
      const statoLabel = record.effectiveStatusLabel || "";
      const cancelledBy = record.cancellation?.cancelledBy || {};
      const cancelledByUsername = cancelledBy.username || "";

      const cancelledAtISO = record.cancellation?.cancelledAt
        ? new Date(record.cancellation.cancelledAt).toISOString()
        : "";

      const cancelReason = record.cancellation?.cancelReason || "";

      return [
        escapeCsv("timbratura"),
        escapeCsv(usernameOut),
        escapeCsv(userIdOut),
        escapeCsv(dataLocale),
        escapeCsv(entrataISO),
        escapeCsv(uscitaISO),
        escapeCsv(durataSec),
        escapeCsv(durataHHMMSS),
        escapeCsv(statusOriginale),
        escapeCsv(statusEffettivo),
        escapeCsv(statoLabel),
        escapeCsv(""),
        escapeCsv(""),
        escapeCsv(""),
        escapeCsv(""),
        escapeCsv(""),
        escapeCsv(""),
        escapeCsv(cancelledByUsername),
        escapeCsv(cancelledAtISO),
        escapeCsv(cancelReason),
      ].join(delimiter);
    });

    const leaveLines = leaves.map((leave) => {
      const populatedUser = leave.user || {};
      const reviewedBy = leave.reviewedBy || {};

      const usernameOut = populatedUser.username || "";
      const userIdOut = populatedUser._id
        ? String(populatedUser._id)
        : String(leave.user || "");

      const dataLocale = leave.date ? formatDateInAppTz(leave.date) : "";

      const reviewedByUsername = reviewedBy.username || "";

      const reviewedAtISO = leave.reviewedAt
        ? new Date(leave.reviewedAt).toISOString()
        : "";

      return [
        escapeCsv("assenza"),
        escapeCsv(usernameOut),
        escapeCsv(userIdOut),
        escapeCsv(dataLocale),
        escapeCsv(""),
        escapeCsv(""),
        escapeCsv(""),
        escapeCsv(""),
        escapeCsv(leave.status || ""),
        escapeCsv(leave.status || ""),
        escapeCsv(leave.statusLabel || ""),
        escapeCsv(leave.typeLabel || leave.type || ""),
        escapeCsv(leave.hours ?? ""),
        escapeCsv(leave.note || ""),
        escapeCsv(reviewedByUsername),
        escapeCsv(reviewedAtISO),
        escapeCsv(leave.reviewNote || ""),
        escapeCsv(""),
        escapeCsv(""),
        escapeCsv(""),
      ].join(delimiter);
    });

    const lines = [...recordLines, ...leaveLines].sort((a, b) => {
      const aColumns = a.split(delimiter);
      const bColumns = b.split(delimiter);

      const aDate = aColumns[3] || "";
      const bDate = bColumns[3] || "";

      return aDate.localeCompare(bDate);
    });

    const csv = [header, ...lines].join("\n");

    res.setHeader(
      "Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="office-clocking_ALL_${fromStr}_to_${toStr}${usernameNormalized ? `_user-${usernameNormalized}` : ""
      }.csv"`
    );

    return res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
}

/**
 * Riepilogo singolo utente.
 *
 * Importante:
 * - i dati di lavoro arrivano da TimeRecord
 * - i dati di assenza arrivano da LeaveRequest
 * - workedDays e absenceDays restano concetti separati
 */
async function getUserSummary(req, res, next) {
  try {
    const { username, from, to } = req.query;

    if (!username || !from || !to) {
      return next(
        new AppError(
          "Parametri richiesti: username, from, to",
          400,
          "MISSING_REQUIRED_PARAMS"
        )
      );
    }

    const rangeValidation = validateDateRange(from, to, MAX_RANGE_DAYS);
    if (!rangeValidation.ok) {
      return next(
        new AppError(rangeValidation.message, 400, "INVALID_DATE_RANGE")
      );
    }

    const userDoc = await User.findOne({
      username: normalizeUsername(username),
    }).lean();

    if (!userDoc) {
      return next(new AppError("Utente non trovato", 404, "USER_NOT_FOUND"));
    }

    const { start, nextDayStart } = getRangeFromToInAppTz(from, to);

    // =========================================================================
    // 1) Timbrature del periodo
    // =========================================================================
    const rawRecords = await TimeRecord.find({
      user: userDoc._id,
      clockIn: {
        $gte: start,
        $lt: nextDayStart,
      },
    })
      .sort({ clockIn: 1 })
      .lean();

    const records = rawRecords.map(decorateRecordForAdmin);
    const closedRecords = records.filter(isEffectivelyClosedRecord);

    const totalSec = closedRecords.reduce((sum, record) => {
      return sum + record.effectiveDurationSec;
    }, 0);

    // =========================================================================
    // 2) Assenze approvate del periodo
    // =========================================================================
    const approvedLeaves = await LeaveRequest.find({
      user: userDoc._id,
      status: "approved",
      $or: [
        {
          startDate: { $lt: nextDayStart },
          endDate: { $gte: start },
        },
        {
          date: {
            $gte: start,
            $lt: nextDayStart,
          },
        },
      ],
    })
      .select("type date startDate endDate status hours")
      .sort({ startDate: 1, date: 1, createdAt: 1 })
      .lean();

    let mutue = 0;
    let ferie = 0;
    let pir = 0;
    const absenceDaysSet = new Set();

    for (const leave of approvedLeaves) {
      const isHourlyPir = leave.type === "pir" && leave.hours != null;

      if (isHourlyPir) {
        continue;
      }

      const leaveDays = getLeaveDaysInRange(leave, start, nextDayStart);

      for (const localDay of leaveDays) {
        absenceDaysSet.add(localDay);
      }

      if (leave.type === "mutua") {
        mutue += leaveDays.length;
      } else if (leave.type === "ferie") {
        ferie += leaveDays.length;
      } else if (leave.type === "pir") {
        pir += leaveDays.length;
      }
    }

    return res.json({
      username: userDoc.username,
      fullName: userDoc.fullName || "",
      role: userDoc.role,
      from,
      to,
      timezone: APP_TZ,

      totalRecords: records.length,
      closedRecords: closedRecords.length,
      totalSec,
      totalHHMMSS: secToHHMMSS(totalSec),
      records,

      mutue,
      ferie,
      pir,
      absenceDays: absenceDaysSet.size,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Riepilogo multiutente.
 *
 * Importante:
 * - i dati di lavoro arrivano solo da TimeRecord
 * - i dati di assenza arrivano solo da LeaveRequest
 * - non mischiamo "workedDays" con "absenceDays"
 */
async function getSummaryAll(req, res, next) {
  try {
    const { from, to, username } = req.query;
    const includeRecords = String(req.query.includeRecords || "") === "true";

    const rangeValidation = validateDateRange(from, to, MAX_RANGE_DAYS);
    if (!rangeValidation.ok) {
      return next(
        new AppError(rangeValidation.message, 400, "INVALID_DATE_RANGE")
      );
    }

    const userQuery = { role: "user", isActive: true };

    if (username) {
      userQuery.username = normalizeUsername(username);
    }

    const users = await User.find(userQuery)
      .select("_id username role fullName")
      .sort({ username: 1 })
      .lean();

    if (!users.length) {
      return res.json({
        from,
        to,
        timezone: APP_TZ,
        totalUsers: 0,
        rows: [],
      });
    }

    const { start, nextDayStart } = getRangeFromToInAppTz(from, to);

    const usersMap = new Map(
      users.map((user) => [
        String(user._id),
        {
          userId: String(user._id),
          username: user.username,
          role: user.role,
          fullName: user.fullName || "",

          totalRecords: 0,
          closedRecords: 0,
          totalSec: 0,
          workedDaysSet: new Set(),
          records: [],

          mutue: 0,
          ferie: 0,
          pir: 0,
          absenceDaysSet: new Set(),
        },
      ])
    );

    // =========================================================================
    // 1) Elaborazione timbrature (TimeRecord)
    // =========================================================================
    const rawRecords = await TimeRecord.find({
      user: { $in: users.map((user) => user._id) },
      clockIn: {
        $gte: start,
        $lt: nextDayStart,
      },
    })
      .sort({ clockIn: 1 })
      .lean();

    const records = rawRecords.map(decorateRecordForAdmin);

    for (const record of records) {
      const userId = String(record.user);
      const bucket = usersMap.get(userId);

      if (!bucket) continue;

      bucket.totalRecords += 1;

      if (includeRecords) {
        bucket.records.push(record);
      }

      if (isEffectivelyClosedRecord(record)) {
        bucket.closedRecords += 1;
        bucket.totalSec += record.effectiveDurationSec;

        const localDay = formatDateInAppTz(record.clockIn);
        if (localDay) {
          bucket.workedDaysSet.add(localDay);
        }
      }
    }

    // =========================================================================
    // 2) Elaborazione assenze (LeaveRequest)
    // Consideriamo solo le leave approvate nel range richiesto.
    // =========================================================================
    const approvedLeaves = await LeaveRequest.find({
      user: { $in: users.map((user) => user._id) },
      status: "approved",
      $or: [
        {
          startDate: { $lt: nextDayStart },
          endDate: { $gte: start },
        },
        {
          date: {
            $gte: start,
            $lt: nextDayStart,
          },
        },
      ],
    })
      .select("user type date startDate endDate status hours")
      .sort({ startDate: 1, date: 1, createdAt: 1 })
      .lean();

    for (const leave of approvedLeaves) {
      const userId = String(leave.user);
      const bucket = usersMap.get(userId);

      if (!bucket) continue;

      const isHourlyPir = leave.type === "pir" && leave.hours != null;

      if (isHourlyPir) {
        continue;
      }

      const leaveDays = getLeaveDaysInRange(leave, start, nextDayStart);

      for (const localDay of leaveDays) {
        bucket.absenceDaysSet.add(localDay);
      }

      if (leave.type === "mutua") {
        bucket.mutue += leaveDays.length;
      } else if (leave.type === "ferie") {
        bucket.ferie += leaveDays.length;
      } else if (leave.type === "pir") {
        bucket.pir += leaveDays.length;
      }
    }

    const rows = Array.from(usersMap.values()).map((item) => {
      const workedDays = item.workedDaysSet.size;
      const absenceDays = item.absenceDaysSet.size;
      const avgSecPerDay =
        workedDays > 0 ? Math.floor(item.totalSec / workedDays) : 0;

      return {
        userId: item.userId,
        username: item.username,
        role: item.role,
        fullName: item.fullName,

        totalRecords: item.totalRecords,
        closedRecords: item.closedRecords,
        totalSec: item.totalSec,
        totalHHMMSS: secToHHMMSS(item.totalSec),

        workedDays,
        avgSecPerDay,
        avgHHMMSS: secToHHMMSS(avgSecPerDay),

        mutue: item.mutue,
        ferie: item.ferie,
        pir: item.pir,
        absenceDays,
        ...(includeRecords ? { records: item.records } : {}),
      };
    });

    return res.json({
      from,
      to,
      timezone: APP_TZ,
      totalUsers: rows.length,
      rows,
    });
  } catch (err) {
    next(err);
  }
}

async function getManualClosureRequests(req, res, next) {
  try {
    const records = await TimeRecord.find({
      status: "pending_manual_closure",
      clockOut: null,
    })
      .populate("user", "username role")
      .sort({ "manualClosureRequest.requestedAt": 1, clockIn: 1 })
      .lean();

    const formattedRecords = records.map((record) => {
      const proposedClockOut =
        record.manualClosureRequest?.proposedClockOut || null;

      let proposedDurationSec = null;

      if (
        record.clockIn &&
        proposedClockOut &&
        new Date(proposedClockOut).getTime() > new Date(record.clockIn).getTime()
      ) {
        proposedDurationSec = calcDurationSec(record.clockIn, proposedClockOut);
      }

      return {
        ...decorateRecordForAdmin(record),
        username: record.user?.username || "",
        proposedDurationSec,
        proposedDurationHHMMSS:
          proposedDurationSec != null ? secToHHMMSS(proposedDurationSec) : null,
      };
    });

    return res.json({
      total: formattedRecords.length,
      records: formattedRecords,
    });
  } catch (err) {
    next(err);
  }
}

async function approveManualClosureRequest(req, res, next) {
  try {
    const { recordId } = req.params;
    const reviewNote = String(req.body?.reviewNote || "").trim();

    const record = await TimeRecord.findById(recordId);

    if (!record) {
      return next(new AppError("Record non trovato", 404, "RECORD_NOT_FOUND"));
    }

    if (record.status !== "pending_manual_closure" || record.clockOut) {
      return next(
        new AppError(
          "Il record non è in attesa di chiusura manuale",
          400,
          "INVALID_RECORD_STATUS"
        )
      );
    }

    const proposedClockOut = record.manualClosureRequest?.proposedClockOut;

    if (!proposedClockOut) {
      return next(
        new AppError(
          "La richiesta non contiene un orario di uscita proposto",
          400,
          "MISSING_PROPOSED_CLOCK_OUT"
        )
      );
    }

    if (
      new Date(proposedClockOut).getTime() <= new Date(record.clockIn).getTime()
    ) {
      return next(
        new AppError(
          "L'orario di uscita proposto non è valido",
          400,
          "INVALID_PROPOSED_CLOCK_OUT"
        )
      );
    }

    const durationSec = calcDurationSec(record.clockIn, proposedClockOut);

    if (durationSec > MAX_MANUAL_CLOSURE_SECONDS) {
      return next(
        new AppError(
          `Impossibile approvare: la durata proposta supera il limite massimo di ${MAX_MANUAL_CLOSURE_HOURS} ore`,
          400,
          "MANUAL_CLOSURE_DURATION_TOO_LONG"
        )
      );
    }

    record.clockOut = proposedClockOut;
    record.durationSec = durationSec;
    record.status = "closed";

    record.manualClosureRequest.reviewedAt = new Date();
    record.manualClosureRequest.reviewedBy = req.user.id;
    record.manualClosureRequest.reviewNote = reviewNote;

    await record.save();

    const savedRecord = await TimeRecord.findById(record._id)
      .populate("user", "username role")
      .populate("manualClosureRequest.reviewedBy", "username role")
      .lean();

    return res.json({
      message: "Richiesta di chiusura manuale approvata",
      record: decorateRecordForAdmin(savedRecord),
    });
  } catch (err) {
    next(err);
  }
}

async function rejectManualClosureRequest(req, res, next) {
  try {
    const { recordId } = req.params;
    const reviewNote = String(req.body?.reviewNote || "").trim();

    const record = await TimeRecord.findById(recordId);

    if (!record) {
      return next(new AppError("Record non trovato", 404, "RECORD_NOT_FOUND"));
    }

    if (record.status !== "pending_manual_closure" || record.clockOut) {
      return next(
        new AppError(
          "Il record non è in attesa di chiusura manuale",
          400,
          "INVALID_RECORD_STATUS"
        )
      );
    }

    record.status = "manual_closure_rejected";
    record.manualClosureRequest.reviewedAt = new Date();
    record.manualClosureRequest.reviewedBy = req.user.id;
    record.manualClosureRequest.reviewNote =
      reviewNote || "Richiesta rifiutata dall'admin";

    await record.save();

    const savedRecord = await TimeRecord.findById(record._id)
      .populate("user", "username role")
      .populate("manualClosureRequest.reviewedBy", "username role")
      .lean();

    return res.json({
      message: "Richiesta di chiusura manuale rifiutata",
      record: decorateRecordForAdmin(savedRecord),
    });
  } catch (err) {
    next(err);
  }
}

function normalizeLeaveNotificationEmails(value) {
  if (!Array.isArray(value)) {
    throw new AppError(
      "Gli indirizzi email devono essere inviati come lista",
      400,
      "INVALID_LEAVE_NOTIFICATION_EMAILS"
    );
  }

  if (value.length > 10) {
    throw new AppError(
      "Puoi inserire al massimo 10 indirizzi email",
      400,
      "TOO_MANY_LEAVE_NOTIFICATION_EMAILS"
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const emails = value
    .map((email) => String(email).trim().toLowerCase())
    .filter(Boolean);

  const uniqueEmails = [...new Set(emails)];

  const invalidEmail = uniqueEmails.find((email) => !emailRegex.test(email));

  if (invalidEmail) {
    throw new AppError(
      "Inserisci solo indirizzi email validi",
      400,
      "INVALID_LEAVE_NOTIFICATION_EMAIL"
    );
  }

  return uniqueEmails;
}

async function getAppSettings(req, res, next) {
  try {
    const settings = await AppSettings.findOneAndUpdate(
      { key: "global" },
      { $setOnInsert: { key: "global" } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({
      settings: {
        leaveMinAdvanceDays: settings.leaveMinAdvanceDays,
        leaveNotificationEmails: settings.leaveNotificationEmails || [],
      },
    });
  } catch (err) {
    next(err);
  }
}

async function updateAppSettings(req, res, next) {
  try {
    const update = {
      key: "global",
    };

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "leaveMinAdvanceDays")) {
      const rawLeaveMinAdvanceDays = req.body.leaveMinAdvanceDays;
      const leaveMinAdvanceDays = Number(rawLeaveMinAdvanceDays);

      if (
        !Number.isInteger(leaveMinAdvanceDays) ||
        leaveMinAdvanceDays < 0 ||
        leaveMinAdvanceDays > 365
      ) {
        return next(
          new AppError(
            "Il numero di giorni di anticipo deve essere un intero tra 0 e 365",
            400,
            "INVALID_LEAVE_MIN_ADVANCE_DAYS"
          )
        );
      }

      update.leaveMinAdvanceDays = leaveMinAdvanceDays;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "leaveNotificationEmails")) {
      update.leaveNotificationEmails = normalizeLeaveNotificationEmails(
        req.body.leaveNotificationEmails
      );
    }

    if (
      !Object.prototype.hasOwnProperty.call(update, "leaveMinAdvanceDays") &&
      !Object.prototype.hasOwnProperty.call(update, "leaveNotificationEmails")
    ) {
      return next(
        new AppError(
          "Nessuna impostazione valida da aggiornare",
          400,
          "NO_SETTINGS_TO_UPDATE"
        )
      );
    }

    const settings = await AppSettings.findOneAndUpdate(
      { key: "global" },
      {
        $set: update,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({
      message: "Impostazioni aggiornate correttamente",
      settings: {
        leaveMinAdvanceDays: settings.leaveMinAdvanceDays,
        leaveNotificationEmails: settings.leaveNotificationEmails || [],
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  adminOnly,
  getUsers,
  createUser,
  updateUserStatus,
  updateUserPassword,
  deleteUser,
  getDashboard,
  getUserRecordsByDay,
  getUserLeaves,
  getLeaveRequests,
  getApprovedLeavesSummary,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelApprovedLeaveRequest,
  cancelTimeRecord,
  exportRecordsCsv,
  getUserSummary,
  getSummaryAll,
  getManualClosureRequests,
  approveManualClosureRequest,
  rejectManualClosureRequest,
  getAppSettings,
  updateAppSettings,
  updateUserGeolocationStatus,
};
