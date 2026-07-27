/**
 * utils/businessRules.js
 *
 * Regole business centrali dell'applicazione.
 * Qui mettiamo costanti e helper riutilizzabili
 * sia dai controller user che admin.
 */

// ============================================================================
// MANUAL CLOSURE
// ============================================================================

/**
 * Durata massima consentita per una chiusura manuale:
 * 12 ore
 */
const MAX_MANUAL_CLOSURE_HOURS = 12;
const MAX_MANUAL_CLOSURE_SECONDS = MAX_MANUAL_CLOSURE_HOURS * 60 * 60;

/**
 * Verifica se una durata in secondi rientra nel limite massimo
 * previsto per la manual closure.
 *
 * @param {number} durationSec
 * @returns {boolean}
 */
function isWithinManualClosureLimit(durationSec) {
  return (
    Number.isFinite(durationSec) &&
    durationSec >= 0 &&
    durationSec <= MAX_MANUAL_CLOSURE_SECONDS
  );
}

module.exports = {
  MAX_MANUAL_CLOSURE_HOURS,
  MAX_MANUAL_CLOSURE_SECONDS,
  isWithinManualClosureLimit,
};