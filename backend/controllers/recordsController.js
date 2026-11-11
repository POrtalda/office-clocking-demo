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
const { calculateWorkDuration, withWorkDuration } = require("../utils/workDuration");
const { withTimeRecordLock } = require("../services/timeRecordLock");
const LeaveRequest = require("../models/LeaveRequest");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const { canUseLocalDemoGps } = require("../utils/localDemoGps");
const { canUseRemoteShowcaseGps } = require("../utils/remoteShowcase");
const { scheduleTimeRecordEmail } = require("../utils/timeRecordNotifications");

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
    status: "approved",
    $and: [
      {
        $or: [
          { type: { $in: ["mutua", "ferie"] } },
          {
            type: "pir",
            hours: null,
          },
        ],
      },
    ],
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

function getGpsPolicy(req, res) {
  // Keep the existing local contract separate: old clients cannot reuse its marker remotely.
  return res.json({ canSkipGps: canUseLocalDemoGps(req), canSkipShowcaseGps: canUseRemoteShowcaseGps(req) });
}

async function shouldValidateGeolocationForUser(userId, req) {
  if (req?.body?.showcaseWithoutGps === true) {
    if (!canUseRemoteShowcaseGps(req)) throw new AppError("GPS disattivabile solo nello Showcase remoto autorizzato", 403, "SHOWCASE_GPS_BYPASS_NOT_ALLOWED");
    return false;
  }
  if (req?.body?.demoWithoutGps === true) {
    if (!canUseLocalDemoGps(req)) {
      throw new AppError("Timbratura senza GPS disponibile solo nella demo locale autorizzata", 403, "DEMO_GPS_BYPASS_NOT_ALLOWED");
    }
    return false;
  }
  // Without explicit remote authorization, Showcase never inherits a per-user exemption.
  if (process.env.APP_ENV === "showcase") return true;
  const userDoc = await User.findById(userId)
    .select("geolocationEnabled")
    .lean();

  return userDoc?.geolocationEnabled !== false;
}

// Non cambiare la modalità predefinita per i client già esistenti.
function readClockMetadata(body) {
  const mode = body?.workLocation ?? "office";
  if (!["office", "offsite"].includes(mode)) {
    throw new AppError("Modalità di timbratura non valida", 400, "INVALID_WORK_LOCATION");
  }
  if ((body?.showcaseWithoutGps === true && (body?.demoWithoutGps === true || body?.location != null)) ||
      (mode === "offsite" && (body?.demoWithoutGps === true || body?.showcaseWithoutGps === true))) {
    throw new AppError("La modalità fuori sede è distinta dalla demo senza GPS", 400, "CONFLICTING_CLOCK_MODES");
  }
  if (body?.note != null && typeof body.note !== "string") {
    throw new AppError("La nota deve essere un testo", 400, "INVALID_CLOCK_NOTE");
  }
  const note = (body?.note || "").trim();
  if (note.length > 1000) {
    throw new AppError("Nota troppo lunga (massimo 1000 caratteri)", 400, "CLOCK_NOTE_TOO_LONG");
  }
  if (mode === "offsite" && typeof body?.offsiteReason !== "string") {
    throw new AppError("Inserisci la motivazione fuori sede", 400, "OFFSITE_REASON_REQUIRED");
  }
  const reason = mode === "offsite" ? body.offsiteReason.trim() : "";
  if (mode === "offsite" && !reason) {
    throw new AppError("Inserisci la motivazione fuori sede", 400, "OFFSITE_REASON_REQUIRED");
  }
  if (reason.length > 500) {
    throw new AppError("Motivazione troppo lunga (massimo 500 caratteri)", 400, "OFFSITE_REASON_TOO_LONG");
  }
  return { mode, note, reason };
}

function readOffsiteLocation(location) {
  if (location == null) return null;
  if (typeof location !== "object" || Array.isArray(location)) {
    throw new AppError("Posizione GPS fuori sede non valida", 400, "INVALID_OFFSITE_LOCATION");
  }
  const { latitude, longitude, accuracy } = location;
  // Non accettare coordinate arbitrarie, vuote o non finite.
  if (latitude == null || longitude == null || latitude === "" || longitude === "") {
    throw new AppError("Coordinate fuori sede non valide", 400, "INVALID_OFFSITE_LOCATION");
  }
  const lat = Number(latitude), lng = Number(longitude);
  const acc = accuracy == null ? null : Number(accuracy);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180 || (acc !== null && (!Number.isFinite(acc) || acc < 0))) {
    throw new AppError("Coordinate fuori sede non valide", 400, "INVALID_OFFSITE_LOCATION");
  }
  return { latitude: lat, longitude: lng, accuracy: acc };
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
    return await withTimeRecordLock(req.user.id, async (_owner, assertActive) => {
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

    const metadata = readClockMetadata(req.body);
    const offsiteLocation = metadata.mode === "offsite"
      ? readOffsiteLocation(req.body?.location)
      : null;

    const shouldValidateGeolocation = metadata.mode === "office" && await shouldValidateGeolocationForUser(
      req.user.id, req
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

    const recordData = {
      user: req.user.id,
      clockIn: new Date(),
      clockOut: null,
      durationSec: 0,
      status: "open",
      clockInLocation,
    };
    // Mantieni il payload storico invariato se la chiamata non aggiunge dati.
    if (metadata.mode === "offsite" || metadata.note) {
      recordData.clockInMode = metadata.mode;
      recordData.clockInNote = metadata.note;
      if (metadata.mode === "offsite") {
        recordData.clockInOffsiteReason = metadata.reason;
        recordData.clockInOffsiteLocation = offsiteLocation;
      }
    }
    await assertActive();
    const record = await TimeRecord.create(recordData);
    if (metadata.mode === "offsite" || metadata.note) {
      scheduleTimeRecordEmail({
        userId: req.user.id, mode: metadata.mode, note: metadata.note,
        reason: metadata.reason, action: "entrata", at: record.clockIn || recordData.clockIn,
      });
    }

    return res.status(201).json({
      message: "Entrata registrata con successo",
      record,
    });
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
    return await withTimeRecordLock(req.user.id, async (_owner, assertActive) => {
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

    const metadata = readClockMetadata(req.body);
    const offsiteLocation = metadata.mode === "offsite"
      ? readOffsiteLocation(req.body?.location)
      : null;

    const shouldValidateGeolocation = metadata.mode === "office" && await shouldValidateGeolocationForUser(
      req.user.id, req
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
    if ((openRecord.breaks || []).some(b => !b.endAt)) {
      return next(new AppError('Termina la pausa prima di registrare l’uscita', 400, 'BREAK_STILL_OPEN'));
    }
    const { durationSec } = calculateWorkDuration(openRecord, now);

    openRecord.clockOut = now;
    openRecord.durationSec = durationSec;
    openRecord.status = "closed";
    openRecord.clockOutLocation = clockOutLocation;
    if (metadata.mode === "offsite" || metadata.note) {
      openRecord.clockOutMode = metadata.mode;
      openRecord.clockOutNote = metadata.note;
      if (metadata.mode === "offsite") {
        openRecord.clockOutOffsiteReason = metadata.reason;
        openRecord.clockOutOffsiteLocation = offsiteLocation;
      }
    }

    await assertActive();
    await openRecord.save();
    if (metadata.mode === "offsite" || metadata.note) {
      scheduleTimeRecordEmail({
        userId: req.user.id, mode: metadata.mode, note: metadata.note,
        reason: metadata.reason, action: "uscita", at: now,
      });
    }

    return res.json({
      message: "Uscita registrata con successo",
      record: openRecord,
    });
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

      return res.json({ records: records.map(withWorkDuration) });
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

      return res.json({ records: records.map(withWorkDuration) });
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

    try {
      calculateWorkDuration(record, proposedClockOut);
    } catch (_) {
      return next(new AppError('La chiusura proposta non è compatibile con le pause', 400, 'BREAK_RANGE_CONFLICT'));
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
    });  } catch (err) {
    return next(err);
  }
}

/** Start/end lunch or other optional break inside the current work session. */
async function changeBreak(req, res, next, ending) {
  try {
    return await withTimeRecordLock(req.user.id, async (_owner, assertActive) => {
      const approvedLeave = await findApprovedLeaveForToday(req.user.id);
      if (approvedLeave) return next(getApprovedLeaveBlockError(approvedLeave, ending ? 'fine pausa' : 'inizio pausa'));
      const record = await findUserActiveOpenRecord(req.user.id);
      if (!record || record.status !== 'open' || !isRecordFromToday(record)) {
        return next(new AppError('Nessuna sessione lavorativa aperta oggi', 400, 'NO_ACTIVE_WORK_SESSION'));
      }
      const activeIndex = (record.breaks || []).findIndex(b => !b.endAt);
      if (ending && activeIndex < 0) return next(new AppError('Nessuna pausa da terminare', 400, 'NO_OPEN_BREAK'));
      if (!ending && activeIndex >= 0) return next(new AppError('Una pausa è già in corso', 400, 'BREAK_ALREADY_OPEN'));
      const metadata = readClockMetadata(req.body);
      const offsiteLocation = metadata.mode === 'offsite' ? readOffsiteLocation(req.body?.location) : null;
      const shouldValidate = metadata.mode === 'office' && await shouldValidateGeolocationForUser(req.user.id, req);
      const validated = shouldValidate ? validateClockInLocation(req.body?.location) : { enabled: false, allowed: true };
      if (!validated.allowed) {
        const errors = {
          INVALID_LOCATION: 'Posizione GPS non valida',
          LOCATION_CONFIG_ERROR: 'Configurazione GPS non valida: contatta l’amministratore',
          LOCATION_OUT_OF_RANGE: 'Sei fuori dall’area aziendale: usa la modalità fuori sede',
        };
        return next(new AppError(errors[validated.code] || 'Verifica geolocalizzazione fallita', 400, validated.code));
      }
      const now = new Date();
      if (ending) {
        const current = record.breaks[activeIndex];
        if (now <= new Date(current.startAt)) return next(new AppError('Fine pausa non valida', 400, 'INVALID_BREAK_END'));
        current.endAt = now;
        current.endMode = metadata.mode;
        current.endLocation = buildValidatedLocation(validated);
        current.endNote = metadata.note;
        current.endOffsiteReason = metadata.reason;
        current.endOffsiteLocation = offsiteLocation;
      } else {
        record.breaks.push({
          startAt: now, startMode: metadata.mode,
          startLocation: buildValidatedLocation(validated),
          startNote: metadata.note,
          startOffsiteReason: metadata.reason,
          startOffsiteLocation: offsiteLocation,
        });
      }
      await assertActive();
      await record.save();
      if (metadata.mode === 'offsite' || metadata.note) {
        scheduleTimeRecordEmail({
          userId: req.user.id, mode: metadata.mode, note: metadata.note,
          reason: metadata.reason, action: ending ? 'fine pausa' : 'inizio pausa', at: now,
        });
      }
      return res.json({ message: ending ? 'Fine pausa registrata' : 'Inizio pausa registrato', record });
    });
  } catch (err) { return next(err); }
}
const startBreak = (req, res, next) => changeBreak(req, res, next, false);
const endBreak = (req, res, next) => changeBreak(req, res, next, true);

module.exports = {
  getGpsPolicy,
  findUserActiveOpenRecord,
  isRecordFromToday,
  calcDurationSec,
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  getMyRecords,
  getMyOpenRecord,
  requestManualClockOut,
};
