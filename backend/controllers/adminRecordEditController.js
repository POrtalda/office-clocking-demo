const mongoose = require("mongoose");
const TimeRecord = require("../models/TimeRecord");
const AppError = require("../utils/AppError");
const { dayjs, APP_TZ, isValidDateString } = require("../utils/dateTime");
const { calculateWorkDuration, withWorkDuration } = require("../utils/workDuration");
const { withTimeRecordLock } = require("../services/timeRecordLock");

function parseLocalRecordDateTime(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value) || !isValidDateString(value.slice(0, 10))) return null;
  const format = value.length === 19 ? "YYYY-MM-DDTHH:mm:ss" : "YYYY-MM-DDTHH:mm";
  const parsed = dayjs.tz(value, format, APP_TZ);
  if (!parsed.isValid() || parsed.format(format) !== value) return null;
  if ([-1, 1].some(hours => parsed.add(hours, "hour").tz(APP_TZ).format(format) === value)) return null;
  return parsed.toDate();
}

async function editTimeRecord(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.recordId)) return next(new AppError("Timbratura non valida", 400, "INVALID_ID"));
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!reason || reason.length > 1000) return next(new AppError("Inserisci una motivazione da 1 a 1000 caratteri", 400, "EDIT_REASON_REQUIRED"));
    const clockIn = parseLocalRecordDateTime(req.body.clockIn);
    const clockOut = parseLocalRecordDateTime(req.body.clockOut);
    if (!clockIn || !clockOut || clockOut <= clockIn) return next(new AppError("Intervallo non valido: usa date e ore Europe/Rome e uscita successiva all'entrata", 400, "INVALID_RECORD_INTERVAL"));
    const owner = await TimeRecord.findById(req.params.recordId).lean();
    if (!owner) return next(new AppError("Timbratura non trovata", 404, "RECORD_NOT_FOUND"));
    return await withTimeRecordLock(String(owner.user), async (_owner, assertActive) => {
      const record = await TimeRecord.findById(req.params.recordId).lean();
      if (!record || String(record.user) !== String(owner.user) || record.status !== "closed" || !record.clockOut) return next(new AppError("Puoi correggere solo sessioni concluse non annullate", 409, "INVALID_RECORD_STATUS"));
      for (const [key, actual] of [["expectedClockIn", record.clockIn], ["expectedClockOut", record.clockOut]]) {
        if (req.body[key] && new Date(req.body[key]).getTime() !== new Date(actual).getTime()) return next(new AppError("La timbratura è cambiata: aggiorna i dati prima di correggerla", 409, "STALE_RECORD"));
      }
      let durationSec;
      try {
        if ((record.breaks || []).some(pause => !pause.endAt)) throw new Error("Pausa aperta");
        ({ durationSec } = calculateWorkDuration({ ...record, clockIn, clockOut }));
      } catch (_) { return next(new AppError("Il nuovo intervallo non è compatibile con le pause registrate", 400, "BREAK_RANGE_CONFLICT")); }
      const overlap = await TimeRecord.findOne({
        _id: { $ne: record._id }, user: record.user, status: { $ne: "cancelled" },
        clockIn: { $lt: clockOut }, $or: [{ clockOut: { $gt: clockIn } }, { clockOut: null }],
      }).select("_id").lean();
      if (overlap) return next(new AppError("Il nuovo intervallo si sovrappone a un'altra sessione", 409, "RECORD_OVERLAP"));
      const filter = { _id: record._id, user: record.user, status: "closed", clockIn: record.clockIn, clockOut: record.clockOut };
      if (record.updatedAt) filter.updatedAt = record.updatedAt;
      if (Number.isFinite(record.__v)) filter.__v = record.__v;
      await assertActive();
      const updated = await TimeRecord.findOneAndUpdate(filter, {
        $set: { clockIn, clockOut, durationSec }, $inc: { __v: 1 },
        $push: { adminEditHistory: { previousClockIn: record.clockIn, previousClockOut: record.clockOut, newClockIn: clockIn, newClockOut: clockOut, reason, editedBy: req.user.id, editedAt: new Date() } },
      }, { returnDocument: "after", runValidators: true }).lean();
      if (!updated) return next(new AppError("La timbratura è cambiata: aggiorna i dati", 409, "STALE_RECORD"));
      return res.json({ message: "Timbratura corretta; motivazione e storico registrati", record: withWorkDuration(updated) });
    });
  } catch (error) { next(error); }
}
module.exports = { editTimeRecord, parseLocalRecordDateTime };
