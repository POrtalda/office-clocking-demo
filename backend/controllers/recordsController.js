/**
 * controllers/recordsController.js
 *
 * Logica delle rotte utente relative alle timbrature.
 *
 * Funzionalità gestite:
 * - clock-in
 * - clock-out
 * - recupero storico personale
 * - recupero eventuale record aperto / anomalo
 * - richiesta di chiusura manuale
 */

const TimeRecord = require("../models/TimeRecord");
const LeaveRequest = require("../models/LeaveRequest");
const User = require("../models/User");
const AppError = require("../utils/AppError");

const {
  dayjs,
  APP_TZ,
  buildSingleDayClockInFilter,
  buildRangeClockInFilter,
  parseAppDateTimeToDate,
} = require("../utils/dateTime");

const {
  MAX_RANGE_DAYS,
  validateDateRange,
  validateSingleDate,
  validateTimeString,
} = require("../utils/validators");

const {
  MAX_MANUAL_CLOSURE_HOURS,
  MAX_MANUAL_CLOSURE_SECONDS,
} = require("../utils/businessRules");

const {
  validateClockInLocation,
} = require("../utils/geolocation");

// ============================================================================
// HELPERS LOCALI
// ============================================================================

/**
 * Cerca l'eventuale record ancora "attivo" dell'utente.
 *
 * Consideriamo attivi:
 * - open
 * - pending_manual_closure
 * - manual_closure_rejected
 *
 * In tutti questi casi il record è ancora senza clockOut.
 *
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function findUserActiveOpenRecord(userId) {
  return TimeRecord.findOne({
    user: userId,
    status: {
      $in: ["open", "pending_manual_closure", "manual_closure_rejected"],
    },
    clockOut: null,
  }).sort({ clockIn: -1 });
}

/**
 * Verifica se il record appartiene al giorno corrente
 * nel timezone ufficiale dell'app.
 *
 * @param {object} record
 * @returns {boolean}
 */
function isRecordFromToday(record) {
  if (!record?.clockIn) return false;

  const todayStr = dayjs().tz(APP_TZ).format("YYYY-MM-DD");
  const recordDayStr = dayjs(record.clockIn).tz(APP_TZ).format("YYYY-MM-DD");

  return recordDayStr === todayStr;
}

/**
 * Verifica se l'utente ha un'assenza approvata per oggi
 * nel timezone ufficiale dell'app.
 *
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function findApprovedLeaveForToday(userId) {
  const todayStr = dayjs().tz(APP_TZ).format("YYYY-MM-DD");
  const startOfDay = dayjs.tz(todayStr, APP_TZ).startOf("day").toDate();
  const endOfDay = dayjs.tz(todayStr, APP_TZ).endOf("day").toDate();

  return LeaveRequest.findOne({
    user: userId,
    type: { $in: ["mutua", "ferie", "pir"] },
    status: "approved",
    $or: [
      {
        startDate: { $lte: endOfDay },
        endDate: { $gte: startOfDay },
      },
      {
        date: { $gte: startOfDay, $lte: endOfDay },
      },
    ],
  });
}

function getApprovedLeaveBlockError(leave, actionLabel) {
  if (leave?.type === "mutua") {
    return new AppError(
      `Hai segnato mutua per oggi: non puoi registrare un'${actionLabel}`,
      400,
      "MUTUA_ALREADY_PRESENT"
    );
  }

  const typeLabel = leave?.type === "pir" ? "PIR" : "ferie";

  return new AppError(
    `Hai un'assenza approvata per oggi (${typeLabel}): non puoi registrare un'${actionLabel}`,
    400,
    "APPROVED_LEAVE_ALREADY_PRESENT"
  );
}

/**
 * Calcola la durata in secondi tra clockIn e clockOut.
 *
 * Non restituisce mai valori negativi.
 *
 * @param {Date|string} clockIn
 * @param {Date|string} clockOut
 * @returns {number}
 */
function calcDurationSec(clockIn, clockOut) {
  const startMs = new Date(clockIn).getTime();
  const endMs = new Date(clockOut).getTime();

  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

/**
 * Costruisce il payload posizione da salvare sul record.
 *
 * Restituisce null quando la geolocalizzazione è disattivata.
 *
 * @param {object} locationValidation
 * @returns {object|null}
 */
function buildValidatedLocation(locationValidation) {
  if (!locationValidation?.enabled || !locationValidation?.allowed) {
    return null;
  }

  return {
    latitude: locationValidation.latitude,
    longitude: locationValidation.longitude,
    accuracy: locationValidation.accuracy,
    distanceMeters: locationValidation.distanceMeters,
    radiusMeters: locationValidation.radiusMeters,
    validatedAt: new Date(),
    validationStatus: "passed",
  };
}

async function shouldValidateGeolocationForUser(userId) {
  const userDoc = await User.findById(userId)
    .select("geolocationEnabled")
    .lean();

  return userDoc?.geolocationEnabled !== false;
}

// ============================================================================
// CONTROLLER - CLOCK IN
// ============================================================================

/**
 * Registra una nuova entrata.
 *
 * Blocca il clock-in se l'utente ha già:
 * - una MUTUA approvata per oggi
 * - una richiesta manual closure pending
 * - una manual closure rifiutata ancora da sistemare
 * - una timbratura aperta oggi
 * - una timbratura aperta di un giorno precedente
 * - una posizione non valida / fuori dall'area autorizzata, se la geolocalizzazione è attiva
 */
async function clockIn(req, res, next) {
  try {
    const approvedLeave = await findApprovedLeaveForToday(req.user.id);

    if (approvedLeave) {
      return next(getApprovedLeaveBlockError(approvedLeave, "entrata"));
    }

    const existingOpen = await findUserActiveOpenRecord(req.user.id);

    if (existingOpen) {
      const fromToday = isRecordFromToday(existingOpen);

      if (existingOpen.status === "pending_manual_closure" && fromToday) {
        return next(
          new AppError(
            "Hai una richiesta di chiusura manuale in attesa di approvazione",
            400,
            "MANUAL_CLOSURE_PENDING"
          )
        );
      }

      if (existingOpen.status === "manual_closure_rejected") {
        return next(
          new AppError(
            "Hai una richiesta di chiusura manuale rifiutata: devi inviarne una nuova",
            400,
            "MANUAL_CLOSURE_REJECTED"
          )
        );
      }

      if (existingOpen.status === "open" && fromToday) {
        return next(
          new AppError(
            "Hai già una timbratura aperta oggi",
            400,
            "OPEN_RECORD_ALREADY_EXISTS"
          )
        );
      }

      if (existingOpen.status === "open" && !fromToday) {
        return next(
          new AppError(
            "Hai una timbratura aperta di un giorno precedente",
            400,
            "OPEN_RECORD_FROM_PREVIOUS_DAY"
          )
        );
      }
    }

    const shouldValidateGeolocation = await shouldValidateGeolocationForUser(
      req.user.id
    );

    const locationValidation = shouldValidateGeolocation
      ? validateClockInLocation(req.body?.location)
      : { enabled: false, allowed: true };

    if (!locationValidation.allowed) {
      const errorMessages = {
        INVALID_LOCATION:
          "Posizione non valida: impossibile registrare l'entrata",
        LOCATION_CONFIG_ERROR:
          "Configurazione geolocalizzazione non valida: contatta l'amministratore",
        LOCATION_OUT_OF_RANGE:
          "Non puoi registrare l'entrata: sei fuori dall'area autorizzata",
      };

      return next(
        new AppError(
          errorMessages[locationValidation.code] ||
            "Posizione non valida: impossibile registrare l'entrata",
          400,
          locationValidation.code
        )
      );
    }

    const clockInLocation = buildValidatedLocation(locationValidation);

    const record = await TimeRecord.create({
      user: req.user.id,
      clockIn: new Date(),
      clockOut: null,
      durationSec: 0,
      status: "open",
      clockInLocation,
    });

    return res.status(201).json({
      message: "Entrata registrata con successo",
      record,
    });
  } catch (err) {
    return next(err);
  }
}

// ============================================================================
// CONTROLLER - CLOCK OUT
// ============================================================================

/**
 * Chiude la timbratura aperta dell'utente.
 *
 * È consentito solo se:
 * - non esiste una MUTUA approvata per oggi
 * - esiste un record attivo
 * - il record è in stato "open"
 * - il record appartiene a oggi nel timezone app
 *
 * Se il record aperto è di un giorno precedente,
 * viene richiesta la manual closure.
 */
async function clockOut(req, res, next) {
  try {
    const approvedLeave = await findApprovedLeaveForToday(req.user.id);

    if (approvedLeave) {
      return next(getApprovedLeaveBlockError(approvedLeave, "uscita"));
    }

    const openRecord = await findUserActiveOpenRecord(req.user.id);

    if (!openRecord) {
      return next(
        new AppError(
          "Nessuna timbratura aperta trovata",
          404,
          "OPEN_RECORD_NOT_FOUND"
        )
      );
    }

    const fromToday = isRecordFromToday(openRecord);

    if (openRecord.status === "pending_manual_closure") {
      return next(
        new AppError(
          "Hai una richiesta di chiusura manuale in attesa di approvazione",
          400,
          "MANUAL_CLOSURE_PENDING"
        )
      );
    }

    if (openRecord.status === "manual_closure_rejected") {
      return next(
        new AppError(
          "La richiesta precedente è stata rifiutata: inviane una nuova",
          400,
          "MANUAL_CLOSURE_REJECTED"
        )
      );
    }

    if (openRecord.status !== "open") {
      return next(
        new AppError(
          "Il record aperto non è in uno stato valido",
          400,
          "INVALID_RECORD_STATUS"
        )
      );
    }

    if (!fromToday) {
      return next(
        new AppError(
          "La timbratura aperta appartiene a un giorno precedente: serve una chiusura manuale",
          400,
          "MANUAL_CLOSURE_REQUIRED"
        )
      );
    }

    const shouldValidateGeolocation = await shouldValidateGeolocationForUser(
      req.user.id
    );

    const locationValidation = shouldValidateGeolocation
      ? validateClockInLocation(req.body?.location)
      : { enabled: false, allowed: true };

    if (!locationValidation.allowed) {
      const errorMessages = {
        INVALID_LOCATION:
          "Posizione non valida: impossibile registrare l'uscita",
        LOCATION_CONFIG_ERROR:
          "Configurazione geolocalizzazione non valida: contatta l'amministratore",
        LOCATION_OUT_OF_RANGE:
          "Non puoi registrare l'uscita: sei fuori dall'area autorizzata",
      };

      return next(
        new AppError(
          errorMessages[locationValidation.code] ||
            "Posizione non valida: impossibile registrare l'uscita",
          400,
          locationValidation.code
        )
      );
    }

    const clockOutLocation = buildValidatedLocation(locationValidation);

    const now = new Date();
    const durationSec = calcDurationSec(openRecord.clockIn, now);

    openRecord.clockOut = now;
    openRecord.durationSec = durationSec;
    openRecord.status = "closed";
    openRecord.clockOutLocation = clockOutLocation;

    await openRecord.save();

    return res.json({
      message: "Uscita registrata con successo",
      record: openRecord,
    });
  } catch (err) {
    return next(err);
  }
}

// ============================================================================
// CONTROLLER - STORICO PERSONALE
// ============================================================================

/**
 * Restituisce lo storico personale dell'utente.
 *
 * Supporta due modalità:
 * - singolo giorno: ?date=YYYY-MM-DD
 * - intervallo: ?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
async function getMyRecords(req, res, next) {
  try {
    const { date, from, to } = req.query;

    // Ricerca per singolo giorno
    if (date) {
      const validation = validateSingleDate(date, "date");

      if (!validation.ok) {
        return next(new AppError(validation.message, 400, "INVALID_DATE"));
      }

      const filter = buildSingleDayClockInFilter(date);

      const records = await TimeRecord.find({
        user: req.user.id,
        clockIn: filter,
      }).sort({ clockIn: 1 });

      return res.json({ records });
    }

    // Ricerca per intervallo
    if (from || to) {
      const validation = validateDateRange(from, to, MAX_RANGE_DAYS);

      if (!validation.ok) {
        return next(
          new AppError(validation.message, 400, "INVALID_DATE_RANGE")
        );
      }

      const filter = buildRangeClockInFilter(from, to);

      const records = await TimeRecord.find({
        user: req.user.id,
        clockIn: filter,
      }).sort({ clockIn: 1 });

      return res.json({ records });
    }

    return next(
      new AppError(
        "Devi specificare ?date=YYYY-MM-DD oppure ?from=YYYY-MM-DD&to=YYYY-MM-DD",
        400,
        "MISSING_DATE_FILTER"
      )
    );
  } catch (err) {
    return next(err);
  }
}

// ============================================================================
// CONTROLLER - RECORD APERTO / ANOMALO
// ============================================================================

/**
 * Restituisce l'eventuale record attivo dell'utente
 * insieme a flag utili per il frontend.
 */
async function getMyOpenRecord(req, res, next) {
  try {
    const openRecord = await findUserActiveOpenRecord(req.user.id);

    if (!openRecord) {
      return res.json({
        record: null,
        isFromPreviousDay: false,
        canRequestManualClosure: false,
      });
    }

    const fromToday = isRecordFromToday(openRecord);

    const canRequestManualClosure =
      (openRecord.status === "open" && !fromToday) ||
      openRecord.status === "manual_closure_rejected";

    return res.json({
      record: openRecord,
      isFromPreviousDay: !fromToday,
      canRequestManualClosure,
    });
  } catch (err) {
    return next(err);
  }
}

// ============================================================================
// CONTROLLER - RICHIESTA CHIUSURA MANUALE
// ============================================================================

/**
 * Permette all'utente di richiedere una chiusura manuale
 * per un record aperto non più chiudibile normalmente.
 *
 * Campi richiesti nel body:
 * - recordId
 * - date (YYYY-MM-DD)
 * - time (HH:mm)
 *
 * Campo opzionale:
 * - note
 */
async function requestManualClockOut(req, res, next) {
  try {
    const { recordId, date, time, note } = req.body || {};

    if (!recordId || !date || !time) {
      return next(
        new AppError(
          "Campi richiesti: recordId, date, time",
          400,
          "MISSING_REQUIRED_FIELDS"
        )
      );
    }

    const dateValidation = validateSingleDate(date, "date");
    if (!dateValidation.ok) {
      return next(new AppError(dateValidation.message, 400, "INVALID_DATE"));
    }

    const timeValidation = validateTimeString(time, "time");
    if (!timeValidation.ok) {
      return next(new AppError(timeValidation.message, 400, "INVALID_TIME"));
    }

    const record = await TimeRecord.findById(recordId);

    if (!record) {
      return next(new AppError("Record non trovato", 404, "RECORD_NOT_FOUND"));
    }

    if (String(record.user) !== String(req.user.id)) {
      return next(
        new AppError(
          "Non puoi modificare un record di un altro utente",
          403,
          "FORBIDDEN"
        )
      );
    }

    const fromToday = isRecordFromToday(record);

    const canRequestManualClosure =
      (record.status === "open" && !fromToday) ||
      record.status === "manual_closure_rejected";

    if (!canRequestManualClosure) {
      return next(
        new AppError(
          "Il record non è in uno stato che consente una chiusura manuale",
          400,
          "MANUAL_CLOSURE_NOT_ALLOWED"
        )
      );
    }

    const proposedClockOut = parseAppDateTimeToDate(date, time);

    if (!proposedClockOut) {
      return next(
        new AppError(
          "Data o ora della chiusura manuale non valida",
          400,
          "INVALID_PROPOSED_CLOCK_OUT"
        )
      );
    }

    if (
      new Date(proposedClockOut).getTime() <= new Date(record.clockIn).getTime()
    ) {
      return next(
        new AppError(
          "L'orario di uscita proposto deve essere successivo all'orario di entrata",
          400,
          "INVALID_PROPOSED_CLOCK_OUT"
        )
      );
    }

    if (new Date(proposedClockOut).getTime() > Date.now()) {
      return next(
        new AppError(
          "L'orario di uscita proposto non può essere nel futuro",
          400,
          "PROPOSED_CLOCK_OUT_IN_FUTURE"
        )
      );
    }

    const proposedDurationSec = calcDurationSec(
      record.clockIn,
      proposedClockOut
    );

    if (proposedDurationSec > MAX_MANUAL_CLOSURE_SECONDS) {
      return next(
        new AppError(
          `La durata proposta supera il limite massimo di ${MAX_MANUAL_CLOSURE_HOURS} ore`,
          400,
          "MANUAL_CLOSURE_DURATION_TOO_LONG"
        )
      );
    }

    record.manualClosureRequest = {
      proposedClockOut,
      note: String(note ?? "").trim(),
      requestedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: "",
    };

    record.status = "pending_manual_closure";

    await record.save();

    return res.json({
      message: "Richiesta di chiusura manuale inviata con successo",
      record,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  findUserActiveOpenRecord,
  isRecordFromToday,
  calcDurationSec,
  clockIn,
  clockOut,
  getMyRecords,
  getMyOpenRecord,
  requestManualClockOut,
};
