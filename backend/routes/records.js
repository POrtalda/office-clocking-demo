/**
 * routes/records.js
 *
 * Rotte delle timbrature riservate all'utente autenticato.
 */

const express = require("express");
const { authMiddleware } = require("../middleware/authMiddleware");

const {
  getGpsPolicy,
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  getMyRecords,
  getMyOpenRecord,
  requestManualClockOut,
} = require("../controllers/recordsController");

const router = express.Router();

router.get("/gps-policy", authMiddleware, getGpsPolicy);

// ============================================================================
// TIMBRATURE UTENTE
// ============================================================================

// Registra una nuova entrata
router.post("/clock-in", authMiddleware, clockIn);

// Registra l'uscita del record aperto
router.post("/clock-out", authMiddleware, clockOut);
router.post("/break-start", authMiddleware, startBreak);
router.post("/break-end", authMiddleware, endBreak);

// Restituisce lo storico personale:
// - singolo giorno: ?date=YYYY-MM-DD
// - intervallo: ?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/my", authMiddleware, getMyRecords);

// Restituisce l'eventuale record aperto / anomalo dell'utente
router.get("/my-open", authMiddleware, getMyOpenRecord);

// Permette di inviare una richiesta di chiusura manuale
router.post(
  "/request-manual-clock-out",
  authMiddleware,
  requestManualClockOut
);

module.exports = router;
