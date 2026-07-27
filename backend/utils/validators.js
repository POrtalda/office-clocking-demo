/**
 * utils/validators.js
 *
 * Funzioni helper condivise per:
 * - normalizzazione username
 * - validazione date singole
 * - validazione intervalli di date
 * - validazione orari nel formato HH:mm
 */

const { dayjs, isValidDateString } = require("./dateTime");

// Limite massimo standard per le ricerche per intervallo.
// Esempio: dal 1 marzo al 31 marzo rientra comodamente.
const MAX_RANGE_DAYS = 62;

/**
 * Normalizza uno username:
 * - converte in stringa
 * - rimuove spazi iniziali/finali
 * - converte in minuscolo
 *
 * Utile per confronti coerenti lato backend.
 *
 * @param {any} value
 * @returns {string}
 */
function normalizeUsername(value) {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * Verifica se lo username, una volta normalizzato,
 * contiene almeno un carattere utile.
 *
 * @param {any} value
 * @returns {boolean}
 */
function hasValidUsername(value) {
  return normalizeUsername(value).length > 0;
}

/**
 * Valida una singola data nel formato YYYY-MM-DD.
 *
 * Restituisce sempre un oggetto uniforme:
 * - ok: true se valida
 * - ok: false con message se non valida
 *
 * @param {string} dateStr
 * @param {string} fieldName
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
function validateSingleDate(dateStr, fieldName = "date") {
  if (!isValidDateString(dateStr)) {
    return {
      ok: false,
      message: `${fieldName} deve essere nel formato YYYY-MM-DD`,
    };
  }

  return { ok: true };
}

/**
 * Valida un intervallo date [from, to].
 *
 * Controlli eseguiti:
 * - presenza di entrambi i parametri
 * - formato corretto YYYY-MM-DD
 * - from <= to
 * - intervallo non oltre il limite massimo
 *
 * Se valido, restituisce anche:
 * - fromDay
 * - toDay
 * - diffDays
 *
 * @param {string} from
 * @param {string} to
 * @param {number} maxRangeDays
 * @returns {{
 *   ok: true,
 *   fromDay: any,
 *   toDay: any,
 *   diffDays: number
 * } | {
 *   ok: false,
 *   message: string
 * }}
 */
function validateDateRange(from, to, maxRangeDays = MAX_RANGE_DAYS) {
  const fromValue = String(from ?? "").trim();
  const toValue = String(to ?? "").trim();

  if (!fromValue || !toValue) {
    return {
      ok: false,
      message: "Parametri richiesti: from, to",
    };
  }

  if (!isValidDateString(fromValue) || !isValidDateString(toValue)) {
    return {
      ok: false,
      message: "from e to devono essere nel formato YYYY-MM-DD",
    };
  }

  // Parsing strettissimo del formato data
  const fromDay = dayjs(fromValue, "YYYY-MM-DD", true);
  const toDay = dayjs(toValue, "YYYY-MM-DD", true);

  if (fromDay.isAfter(toDay, "day")) {
    return {
      ok: false,
      message: "Intervallo non valido: from deve essere <= to",
    };
  }

  // +1 perché il conteggio è inclusivo:
  // es. 2026-03-01 -> 2026-03-01 = 1 giorno
  const diffDays = toDay.diff(fromDay, "day") + 1;

  if (diffDays > maxRangeDays) {
    return {
      ok: false,
      message: `Range troppo ampio (max ${maxRangeDays} giorni)`,
    };
  }

  return {
    ok: true,
    fromDay,
    toDay,
    diffDays,
  };
}

/**
 * Valida un orario nel formato HH:mm (24 ore).
 *
 * Esempi validi:
 * - 08:00
 * - 14:35
 * - 23:59
 *
 * Esempi non validi:
 * - 8:00
 * - 24:00
 * - 12:7
 *
 * @param {string} timeStr
 * @param {string} fieldName
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
function validateTimeString(timeStr, fieldName = "time") {
  const value = String(timeStr ?? "").trim();

  const isValid = /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);

  if (!isValid) {
    return {
      ok: false,
      message: `${fieldName} deve essere nel formato HH:mm`,
    };
  }

  return { ok: true };
}

module.exports = {
  MAX_RANGE_DAYS,
  normalizeUsername,
  hasValidUsername,
  validateSingleDate,
  validateDateRange,
  validateTimeString,
};