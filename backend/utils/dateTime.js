/**
 * utils/dateTime.js
 *
 * Helper condivisi per:
 * - timezone ufficiale dell'app
 * - validazione rigorosa di date e orari
 * - conversione giorni locali Europe/Rome in range UTC per MongoDB
 * - parsing di data + ora locali dell'app
 * - formattazione date/orari nel timezone applicativo
 * - conversione secondi in HH:MM:SS
 */

const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const customParseFormat = require("dayjs/plugin/customParseFormat");

// ============================================================================
// CONFIGURAZIONE DAYJS
// ============================================================================

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

// Timezone ufficiale dell'applicazione
const APP_TZ = "Europe/Rome";

// ============================================================================
// VALIDAZIONI BASE
// ============================================================================

/**
 * Verifica in modo rigoroso che una stringa sia una data valida
 * nel formato YYYY-MM-DD.
 *
 * Esempi validi:
 * - 2026-03-18
 *
 * Esempi non validi:
 * - 18-03-2026
 * - 2026/03/18
 * - 2026-02-31
 *
 * @param {string} value
 * @returns {boolean}
 */
function isValidDateString(value) {
  return dayjs(String(value ?? ""), "YYYY-MM-DD", true).isValid();
}

/**
 * Verifica in modo rigoroso che una stringa sia un orario valido
 * nel formato HH:mm (24 ore).
 *
 * Esempi validi:
 * - 08:30
 * - 23:59
 *
 * Esempi non validi:
 * - 8:30
 * - 24:00
 * - 12:7
 *
 * @param {string} value
 * @returns {boolean}
 */
function isValidTimeString(value) {
  return dayjs(String(value ?? ""), "HH:mm", true).isValid();
}

// ============================================================================
// RANGE GIORNALIERO / INTERVALLO IN TIMEZONE APP
// ============================================================================

/**
 * Converte un giorno locale dell'app (Europe/Rome)
 * nel corrispondente intervallo UTC da usare nelle query MongoDB.
 *
 * Pattern query consigliato:
 *   campo >= start
 *   campo < nextDayStart
 *
 * Questo evita errori vicino a mezzanotte e mantiene coerenza
 * con il calendario locale Europe/Rome.
 *
 * @param {string} dateStr - formato YYYY-MM-DD
 * @returns {{ start: Date, nextDayStart: Date }}
 */
function getDayRangeInAppTz(dateStr) {
  const localStart = dayjs.tz(
    `${dateStr} 00:00:00`,
    "YYYY-MM-DD HH:mm:ss",
    APP_TZ
  );

  return {
    start: localStart.utc().toDate(),
    nextDayStart: localStart.add(1, "day").utc().toDate(),
  };
}

/**
 * Restituisce il range UTC corrispondente a un intervallo di giorni locali
 * dell'applicazione.
 *
 * fromStr e toStr sono intesi come giorni inclusivi lato utente,
 * ma in query Mongo è preferibile usare:
 *   campo >= start
 *   campo < nextDayStart
 *
 * @param {string} fromStr - formato YYYY-MM-DD
 * @param {string} toStr - formato YYYY-MM-DD
 * @returns {{ start: Date, nextDayStart: Date }}
 */
function getRangeFromToInAppTz(fromStr, toStr) {
  const { start } = getDayRangeInAppTz(fromStr);
  const { nextDayStart } = getDayRangeInAppTz(toStr);

  return { start, nextDayStart };
}

/**
 * Costruisce direttamente il filtro Mongo per un singolo giorno locale
 * basato sul campo clockIn.
 *
 * Esempio:
 * {
 *   $gte: ...,
 *   $lt: ...
 * }
 *
 * @param {string} dateStr - formato YYYY-MM-DD
 * @returns {{ $gte: Date, $lt: Date }}
 */
function buildSingleDayClockInFilter(dateStr) {
  const { start, nextDayStart } = getDayRangeInAppTz(dateStr);

  return {
    $gte: start,
    $lt: nextDayStart,
  };
}

/**
 * Costruisce direttamente il filtro Mongo per un intervallo locale
 * basato sul campo clockIn.
 *
 * @param {string} fromStr - formato YYYY-MM-DD
 * @param {string} toStr - formato YYYY-MM-DD
 * @returns {{ $gte: Date, $lt: Date }}
 */
function buildRangeClockInFilter(fromStr, toStr) {
  const { start, nextDayStart } = getRangeFromToInAppTz(fromStr, toStr);

  return {
    $gte: start,
    $lt: nextDayStart,
  };
}

// ============================================================================
// PARSING DATA + ORA LOCALI
// ============================================================================

/**
 * Converte una data locale dell'app + un orario locale dell'app
 * in un oggetto Date JavaScript.
 *
 * Esempio input:
 * - dateStr = "2026-03-15"
 * - timeStr = "18:30"
 *
 * Restituisce:
 * - Date valida se il parsing va a buon fine
 * - null se uno dei parametri non è valido
 *
 * @param {string} dateStr
 * @param {string} timeStr
 * @returns {Date | null}
 */
function parseAppDateTimeToDate(dateStr, timeStr) {
  if (!isValidDateString(dateStr)) return null;
  if (!isValidTimeString(timeStr)) return null;

  const parsed = dayjs.tz(
    `${dateStr} ${timeStr}`,
    "YYYY-MM-DD HH:mm",
    APP_TZ
  );

  if (!parsed.isValid()) {
    return null;
  }

  return parsed.toDate();
}

// ============================================================================
// FORMATTAZIONE NEL TIMEZONE APP
// ============================================================================

/**
 * Formatta una data in YYYY-MM-DD nel timezone dell'app.
 *
 * @param {Date|string|number} dateValue
 * @returns {string}
 */
function formatDateInAppTz(dateValue) {
  if (!dateValue) return "";
  return dayjs(dateValue).tz(APP_TZ).format("YYYY-MM-DD");
}

/**
 * Formatta una data in HH:mm nel timezone dell'app.
 *
 * @param {Date|string|number} dateValue
 * @returns {string}
 */
function formatTimeInAppTz(dateValue) {
  if (!dateValue) return "";
  return dayjs(dateValue).tz(APP_TZ).format("HH:mm");
}

/**
 * Formatta una data in YYYY-MM-DD HH:mm nel timezone dell'app.
 *
 * @param {Date|string|number} dateValue
 * @returns {string}
 */
function formatDateTimeInAppTz(dateValue) {
  if (!dateValue) return "";
  return dayjs(dateValue).tz(APP_TZ).format("YYYY-MM-DD HH:mm");
}

// ============================================================================
// DURATA
// ============================================================================

/**
 * Converte secondi in formato HH:MM:SS.
 *
 * Esempi:
 * - 0 -> 00:00:00
 * - 65 -> 00:01:05
 * - 3661 -> 01:01:01
 *
 * @param {number} sec
 * @returns {string}
 */
function secToHHMMSS(sec) {
  if (sec == null) return "";

  const totalSeconds = Math.max(0, Math.floor(Number(sec) || 0));

  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");

  return `${hh}:${mm}:${ss}`;
}

module.exports = {
  dayjs,
  APP_TZ,
  isValidDateString,
  isValidTimeString,
  getDayRangeInAppTz,
  getRangeFromToInAppTz,
  buildSingleDayClockInFilter,
  buildRangeClockInFilter,
  parseAppDateTimeToDate,
  formatDateInAppTz,
  formatTimeInAppTz,
  formatDateTimeInAppTz,
  secToHHMMSS,
};