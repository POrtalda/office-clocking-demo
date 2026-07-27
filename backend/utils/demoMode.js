/**
 * utils/demoMode.js
 *
 * Utility centralizzata per sapere se l'app è in modalità demo.
 * La modalità demo serve per presentazioni clienti e ambienti dimostrativi.
 */

function isDemoMode() {
  return process.env.DEMO_MODE === "true";
}

module.exports = {
  isDemoMode,
};