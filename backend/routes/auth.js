/**
 * routes/auth.js
 *
 * Rotte di autenticazione per Office Clocking.
 *
 * Questo file deve restare leggero:
 * - definisce gli endpoint
 * - applica i middleware necessari
 * - delega la logica ai controller
 *
 * Logica business:
 * - controllers/authController.js
 *
 * Middleware usati:
 * - loginLimiter   -> limita i tentativi di login
 * - authMiddleware -> verifica il JWT nelle route protette
 */

const express = require("express");

// ============================================================================
// IMPORT MIDDLEWARE
// ============================================================================

/**
 * authMiddleware
 * Controlla la presenza e la validità del token JWT.
 * Se il token è valido, inserisce i dati utente in req.user.
 */
const { authMiddleware } = require("../middleware/authMiddleware");

/**
 * loginLimiter
 * Limita i tentativi di login ripetuti.
 * Nel progetto è già stato adattato per lavorare per username
 * e non come blocco globale indistinto.
 */
const { loginLimiter } = require("../middleware/loginLimiter");

// ============================================================================
// IMPORT CONTROLLER
// ============================================================================

/**
 * loginUser
 * Gestisce il login utente e restituisce token + dati utente essenziali.
 *
 * getMe
 * Restituisce i dati dell'utente autenticato attuale.
 */
const { loginUser, getMe } = require("../controllers/authController");

// ============================================================================
// CREAZIONE ROUTER
// ============================================================================
const router = express.Router();

// ============================================================================
// ROTTE AUTH
// ============================================================================

/**
 * POST /api/auth/login
 *
 * Scopo:
 * - autenticare l'utente tramite username + password
 *
 * Middleware:
 * - loginLimiter
 *
 * Controller:
 * - loginUser
 */
router.post("/login", loginLimiter, loginUser);

/**
 * GET /api/auth/me
 *
 * Scopo:
 * - verificare il token attuale
 * - recuperare i dati essenziali dell'utente loggato
 *
 * Middleware:
 * - authMiddleware
 *
 * Controller:
 * - getMe
 */
router.get("/me", authMiddleware, getMe);

// ============================================================================
// EXPORT ROUTER
// ============================================================================
module.exports = router;
