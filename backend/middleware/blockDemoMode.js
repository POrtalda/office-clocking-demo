/**
 * middlewares/blockDemoMode.js
 *
 * Middleware per bloccare azioni sensibili quando l'app è in modalità demo.
 * Utile per evitare modifiche distruttive durante presentazioni o prove clienti.
 */

const { isDemoMode } = require("../utils/demoMode");

function blockDemoMode(req, res, next) {
  if (isDemoMode()) {
    return res.status(403).json({
      success: false,
      message: "Azione disabilitata nella versione demo",
      code: "DEMO_MODE_BLOCKED",
    });
  }

  next();
}

module.exports = blockDemoMode;
