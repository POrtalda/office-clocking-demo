const express = require("express");
const {
  createMutua,
  createFerieRequest,
  createPirRequest,
  getMyLeaves,
} = require("../controllers/leaveController");
const { authMiddleware } = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * GET /api/leaves/my
 *
 * Restituisce le leave dell'utente autenticato.
 * Supporta:
 * - ?date=YYYY-MM-DD
 * - ?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get("/my", authMiddleware, getMyLeaves);

/**
 * POST /api/leaves/mutua
 *
 * Segna una mutua giornaliera per l'utente autenticato.
 * La mutua viene creata direttamente come approved.
 */
router.post("/mutua", authMiddleware, createMutua);

/**
 * POST /api/leaves/ferie
 *
 * Invia una richiesta ferie giornaliera
 * per l'utente autenticato.
 * Stato iniziale: pending.
 */
router.post("/ferie", authMiddleware, createFerieRequest);

/**
 * POST /api/leaves/pir
 *
 * Invia una richiesta PIR giornaliera
 * per l'utente autenticato.
 * Stato iniziale: pending.
 */
router.post("/pir", authMiddleware, createPirRequest);

module.exports = router;