/**
 * utils/businessRules.js
 *
 * Regole business centralizzate dell'app.
 *
 * Qui mettiamo soglie e vincoli che non dipendono dalla UI,
 * ma dalla logica aziendale del progetto.
 */

/**
 * Durata massima consentita per una richiesta di chiusura manuale.
 *
 * Esempio:
 * - il dipendente ha dimenticato il clock-out
 * - il giorno dopo propone un orario di uscita
 *
 * Per evitare richieste anomale da 20h / 24h / 28h, mettiamo una soglia.
 */
const MAX_MANUAL_CLOSURE_DURATION_HOURS = 12;

/**
 * Stessa soglia espressa in secondi.
 * Utile per i confronti diretti con durationSec.
 */
const MAX_MANUAL_CLOSURE_DURATION_SEC =
  MAX_MANUAL_CLOSURE_DURATION_HOURS * 60 * 60;

module.exports = {
  MAX_MANUAL_CLOSURE_DURATION_HOURS,
  MAX_MANUAL_CLOSURE_DURATION_SEC,
};