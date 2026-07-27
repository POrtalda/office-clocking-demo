const LeaveRequest = require("../models/LeaveRequest");
const TimeRecord = require("../models/TimeRecord");
const AppSettings = require("../models/AppSettings");
const { sendEmail } = require("../utils/email");
const AppError = require("../utils/AppError");

const {
  dayjs,
  APP_TZ,
  buildSingleDayClockInFilter,
} = require("../utils/dateTime");

const {
  validateSingleDate,
  validateDateRange,
} = require("../utils/validators");

function formatDateIT(date) {
  if (!date) {
    return "-";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return parsedDate.toLocaleDateString("it-IT");
}

function getLeavePeriodLabel(leave) {
  if (leave?.startDate && leave?.endDate) {
    return `dal ${formatDateIT(leave.startDate)} al ${formatDateIT(
      leave.endDate
    )}`;
  }

  if (leave?.date) {
    return formatDateIT(leave.date);
  }

  return "-";
}

function getLeaveEmailTypeLabel(type) {
  if (type === "ferie") {
    return "Ferie";
  }

  if (type === "pir") {
    return "PIR";
  }

  return String(type || "").toUpperCase();
}

/**
 * Costruisce il filtro Mongo per una singola giornata
 * interpretata nel timezone applicativo.
 */
function buildSingleDayLeaveDateFilter(dateStr) {
  const startOfDay = dayjs.tz(dateStr, APP_TZ).startOf("day").toDate();
  const endOfDay = dayjs.tz(dateStr, APP_TZ).endOf("day").toDate();

  return {
    date: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  };
}

/**
 * Costruisce il filtro Mongo per un intervallo di giorni
 * interpretato nel timezone applicativo.
 */
function buildRangeLeaveDateFilter(from, to) {
  const start = dayjs.tz(from, APP_TZ).startOf("day").toDate();
  const end = dayjs.tz(to, APP_TZ).endOf("day").toDate();

  return {
    date: {
      $gte: start,
      $lte: end,
    },
  };
}

function buildSingleDayLeavePeriodFilter(dateStr) {
  const startOfDay = dayjs.tz(dateStr, APP_TZ).startOf("day").toDate();
  const endOfDay = dayjs.tz(dateStr, APP_TZ).endOf("day").toDate();

  return {
    $or: [
      {
        startDate: { $lte: endOfDay },
        endDate: { $gte: startOfDay },
      },
      {
        date: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      },
    ],
  };
}

function buildRangeLeavePeriodFilter(from, to) {
  const start = dayjs.tz(from, APP_TZ).startOf("day").toDate();
  const end = dayjs.tz(to, APP_TZ).endOf("day").toDate();

  return {
    $or: [
      {
        startDate: { $lte: end },
        endDate: { $gte: start },
      },
      {
        date: {
          $gte: start,
          $lte: end,
        },
      },
    ],
  };
}

/**
 * Restituisce il giorno corrente come YYYY-MM-DD
 * nel timezone applicativo.
 */
function getTodayInAppTz() {
  return dayjs().tz(APP_TZ).format("YYYY-MM-DD");
}

function getLeaveTypeLabel(type) {
  if (type === "mutua") return "mutua";
  if (type === "ferie") return "ferie";
  if (type === "pir") return "PIR";
  return "assenza";
}

async function notifyLeaveRequestCreated({ user, leave }) {
  if (!["ferie", "pir"].includes(leave?.type)) {
    return;
  }

  try {
    const settings = await AppSettings.findOneAndUpdate(
      { key: "global" },
      { $setOnInsert: { key: "global" } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    const recipients = settings?.leaveNotificationEmails || [];

    if (recipients.length === 0) {
      return;
    }

    const userLabel = user?.username || "Utente";
    const typeLabel = getLeaveEmailTypeLabel(leave.type);
    const periodLabel = getLeavePeriodLabel(leave);

    await sendEmail({
      to: recipients,
      subject: `Nuova richiesta ${typeLabel} - ${userLabel}`,
      text: [
        "È stata inviata una nuova richiesta di assenza.",
        "",
        `Utente: ${userLabel}`,
        `Tipo richiesta: ${typeLabel}`,
        `Periodo/Giorno: ${periodLabel}`,
        "Stato: In attesa",
        "",
        "Accedi alla dashboard admin di Office Clocking per approvare o rifiutare la richiesta.",
      ].join("\n"),
    });
  } catch (err) {
    console.error("Errore invio email notifica ferie/PIR", err);
  }
}

function scheduleLeaveRequestNotification({ user, leave }) {
  setImmediate(() => {
    notifyLeaveRequestCreated({ user, leave }).catch((error) => {
      console.error(
        "Errore inatteso scheduling notifica ferie/PIR",
        error
      );
    });
  });
}

async function getLeaveMinAdvanceDays() {
  const settings = await AppSettings.findOneAndUpdate(
    { key: "global" },
    { $setOnInsert: { key: "global" } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return settings.leaveMinAdvanceDays;
}

async function ensureLeaveRespectsMinAdvance(dateStr) {
  const leaveMinAdvanceDays = await getLeaveMinAdvanceDays();

  const requestedDate = dayjs.tz(dateStr, APP_TZ).startOf("day");
  const minAllowedDate = dayjs()
    .tz(APP_TZ)
    .startOf("day")
    .add(leaveMinAdvanceDays, "day");

  if (requestedDate.isBefore(minAllowedDate)) {
    throw new AppError(
      `La richiesta deve essere inviata con almeno ${leaveMinAdvanceDays} giorni di anticipo.`,
      400,
      "LEAVE_MIN_ADVANCE_NOT_RESPECTED"
    );
  }
}

function buildLeavePeriod(startDateStr, endDateStr) {
  validateDateRange(startDateStr, endDateStr);

  const startDate = dayjs.tz(startDateStr, APP_TZ).startOf("day").toDate();
  const endDate = dayjs.tz(endDateStr, APP_TZ).startOf("day").toDate();

  return {
    startDate,
    endDate,
    date: startDate,
  };
}

/**
 * Helper riusabile:
 * crea una leave per oggi per l'utente autenticato.
 *
 * Permette di gestire facilmente:
 * - mutua  -> approved
 * - ferie  -> pending
 * - pir    -> pending
 */
async function createDailyLeave({
  userId,
  user,
  type,
  status,
  note = "",
  dateStr = getTodayInAppTz(),
}) {
  validateSingleDate(dateStr);

  if (type === "ferie" || type === "pir") {
    await ensureLeaveRespectsMinAdvance(dateStr);
  }

  const leavePeriod = buildLeavePeriod(dateStr, dateStr);

  const existingActiveLeave = await LeaveRequest.findOne({
    user: userId,
    status: { $in: ["approved", "pending"] },
    $or: [
      {
        startDate: { $lte: leavePeriod.endDate },
        endDate: { $gte: leavePeriod.startDate },
      },
      {
        date: {
          $gte: leavePeriod.startDate,
          $lte: leavePeriod.endDate,
        },
      },
    ],
  });

  if (existingActiveLeave) {
    throw new AppError(
      `Hai gia inserito un'assenza per il giorno selezionato (${getLeaveTypeLabel(
        existingActiveLeave.type
      )}).`,
      409,
      "LEAVE_ALREADY_PRESENT"
    );
  }

  const existingTimeRecord = await TimeRecord.findOne({
    user: userId,
    clockIn: buildSingleDayClockInFilter(dateStr),
  });

  if (existingTimeRecord) {
    throw new AppError(
      "Non puoi inserire un'assenza: esiste gia una timbratura per il giorno selezionato.",
      409,
      "TIMERECORD_ALREADY_PRESENT"
    );
  }

  const leaveDate = leavePeriod.date;

  const leave = await LeaveRequest.create({
    user: userId,
    type,
    status,
    date: leaveDate,
    startDate: leavePeriod.startDate,
    endDate: leavePeriod.endDate,
    note,
  });

  scheduleLeaveRequestNotification({
    user,
    leave,
  });

  return leave;
}

/**
 * GET /api/leaves/my
 *
 * Supporta:
 * - ?date=YYYY-MM-DD
 * - ?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Restituisce solo le leave dell'utente autenticato.
 */
async function getMyLeaves(req, res, next) {
  try {
    const userId = req.user.id;
    const { date, from, to } = req.query;

    const filter = { user: userId };

    if (date) {
      validateSingleDate(date);
      Object.assign(filter, buildSingleDayLeavePeriodFilter(date));
    } else if (from || to) {
      validateDateRange(from, to);
      Object.assign(filter, buildRangeLeavePeriodFilter(from, to));
    }

    const leaves = await LeaveRequest.find(filter).sort({
      date: -1,
      createdAt: -1,
    });

    return res.status(200).json({
      leaves,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/leaves/mutua
 *
 * Crea una mutua giornaliera approvata direttamente
 * per l'utente autenticato.
 */
async function createMutua(req, res, next) {
  try {
    const userId = req.user.id;
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";

    const leave = await createDailyLeave({
      userId,
      user: req.user,
      type: "mutua",
      status: "approved",
      note,
    });

    return res.status(201).json({
      message: "Mutua segnata con successo.",
      leave,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/leaves/ferie
 *
 * Crea una richiesta ferie in stato pending.
 * Supporta sia una singola data sia un periodo startDate/endDate.
 */
async function createFerieRequest(req, res, next) {
  try {
    const userId = req.user.id;
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
    const startDateStr = req.body?.startDate || req.body?.date;
    const endDateStr = req.body?.endDate || startDateStr;

    const leavePeriod = buildLeavePeriod(startDateStr, endDateStr);

    await ensureLeaveRespectsMinAdvance(startDateStr);

    const existingActiveLeave = await LeaveRequest.findOne({
      user: userId,
      status: { $in: ["approved", "pending"] },
      $or: [
        {
          startDate: { $lte: leavePeriod.endDate },
          endDate: { $gte: leavePeriod.startDate },
        },
        {
          date: {
            $gte: leavePeriod.startDate,
            $lte: leavePeriod.endDate,
          },
        },
      ],
    });

    if (existingActiveLeave) {
      throw new AppError(
        `Hai gia inserito un'assenza per il periodo selezionato (${getLeaveTypeLabel(
          existingActiveLeave.type
        )}).`,
        409,
        "LEAVE_ALREADY_PRESENT"
      );
    }

    const existingTimeRecord = await TimeRecord.findOne({
      user: userId,
      clockIn: {
        $gte: leavePeriod.startDate,
        $lte: dayjs(leavePeriod.endDate).tz(APP_TZ).endOf("day").toDate(),
      },
    });

    if (existingTimeRecord) {
      throw new AppError(
        "Non puoi inserire ferie: esiste gia una timbratura nel periodo selezionato.",
        409,
        "TIMERECORD_ALREADY_PRESENT"
      );
    }

    const leave = await LeaveRequest.create({
      user: userId,
      type: "ferie",
      status: "pending",
      ...leavePeriod,
      note,
    });

    scheduleLeaveRequestNotification({
      user: req.user,
      leave,
    });

    return res.status(201).json({
      message: "Richiesta ferie inviata con successo.",
      leave,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/leaves/pir
 *
 * Crea una richiesta PIR giornaliera in stato pending.
 */
async function createPirRequest(req, res, next) {
  try {
    const userId = req.user.id;
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
    const dateStr = req.body?.date;

    const leave = await createDailyLeave({
      userId,
      user: req.user,
      type: "pir",
      status: "pending",
      note,
      dateStr,
    });

    return res.status(201).json({
      message: "Richiesta PIR inviata con successo.",
      leave,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createMutua,
  createFerieRequest,
  createPirRequest,
  getMyLeaves,
};
