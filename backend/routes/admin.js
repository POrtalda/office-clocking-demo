/**
 * routes/admin.js
 *
 * Router delle rotte riservate agli amministratori.
 *
 * Responsabilità:
 * - definire gli endpoint sotto /api/admin
 * - applicare i middleware di protezione
 * - inoltrare ogni richiesta al controller corretto
 */

const express = require("express");
const { authMiddleware } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/requireRole");
const blockDemoMode = require("../middleware/blockDemoMode");

const {
  adminOnly,
  getUsers,
  createUser,
  updateUserStatus,
  updateUserGeolocationStatus,
  updateUserPassword,
  deleteUser,
  getDashboard,
  getUserRecordsByDay,
  exportRecordsCsv,
  getUserSummary,
  getSummaryAll,
  getManualClosureRequests,
  approveManualClosureRequest,
  rejectManualClosureRequest,
  getUserLeaves,
  getLeaveRequests,
  getApprovedLeavesSummary,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelApprovedLeaveRequest,
  cancelTimeRecord,
  getAppSettings,
  updateAppSettings,
} = require("../controllers/adminController");

const router = express.Router();

// Tutte le route admin richiedono:
// - utente autenticato
// - ruolo admin
const adminGuards = [authMiddleware, requireRole("admin")];

// ============================================================================
// TEST / SUPPORTO
// ============================================================================

// Verifica accesso admin
router.get("/only", ...adminGuards, adminOnly);

// ============================================================================
// GESTIONE UTENTI
// ============================================================================

// Lista utenti disponibile all'admin
router.get("/users", ...adminGuards, getUsers);

// Creazione nuovo utente da parte dell'admin
// In demo la lasciamo attiva per poter mostrare la creazione utenti.
router.post("/users", ...adminGuards, createUser);

// Attivazione / disattivazione utente
// Bloccata in demo per evitare modifiche distruttive sugli utenti demo.
router.patch("/users/:id/status", ...adminGuards, blockDemoMode, updateUserStatus);

// Attivazione / disattivazione geolocalizzazione utente
router.patch(
  "/users/:id/geolocation",
  ...adminGuards,
  updateUserGeolocationStatus
);

// Reset password utente da parte dell'admin
// Bloccata in demo per evitare che le credenziali demo vengano alterate.
router.patch(
  "/users/:id/password",
  ...adminGuards,
  blockDemoMode,
  updateUserPassword
);

// Cancellazione sicura utente
// Bloccata in demo per evitare eliminazioni durante prove o presentazioni.
router.delete("/users/:id", ...adminGuards, blockDemoMode, deleteUser);

// ============================================================================
// IMPOSTAZIONI
// ============================================================================

// Lettura impostazioni globali app
router.get("/settings", ...adminGuards, getAppSettings);

// Aggiornamento impostazioni globali app
router.patch("/settings", ...adminGuards, updateAppSettings);

// ============================================================================
// DASHBOARD
// ============================================================================

// Dashboard riepilogativa admin
router.get("/dashboard", ...adminGuards, getDashboard);

// ============================================================================
// DETTAGLIO E REPORT
// ============================================================================

// Dettaglio giornaliero di un utente
router.get("/records", ...adminGuards, getUserRecordsByDay);

// Leave / assenze di un utente.
// Supporta:
// - ?username=mario&date=YYYY-MM-DD
// - ?username=mario&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/leaves", ...adminGuards, getUserLeaves);

// Richieste leave pendenti da revisionare
router.get("/leave-requests", ...adminGuards, getLeaveRequests);

// Riepilogo ferie/PIR approvati
router.get("/approved-leaves", ...adminGuards, getApprovedLeavesSummary);

// Approva richiesta leave
router.post(
  "/leave-requests/:leaveId/approve",
  ...adminGuards,
  approveLeaveRequest
);

// Rifiuta richiesta leave
router.post(
  "/leave-requests/:leaveId/reject",
  ...adminGuards,
  rejectLeaveRequest
);

// Annulla richiesta ferie/PIR approvata
router.post(
  "/leave-requests/:leaveId/cancel",
  ...adminGuards,
  cancelApprovedLeaveRequest
);

// Export CSV timbrature
router.get("/export", ...adminGuards, exportRecordsCsv);

// Annulla logicamente una timbratura errata
router.post("/records/:recordId/cancel", ...adminGuards, cancelTimeRecord);

// Riepilogo singolo utente
router.get("/summary", ...adminGuards, getUserSummary);

// Riepilogo multiutente
router.get("/summary-all", ...adminGuards, getSummaryAll);

// ============================================================================
// CHIUSURE MANUALI
// ============================================================================

// Elenco richieste di chiusura manuale pendenti
router.get(
  "/manual-closure-requests",
  ...adminGuards,
  getManualClosureRequests
);

// Approva richiesta di chiusura manuale
router.post(
  "/manual-closure-requests/:recordId/approve",
  ...adminGuards,
  approveManualClosureRequest
);

// Rifiuta richiesta di chiusura manuale
router.post(
  "/manual-closure-requests/:recordId/reject",
  ...adminGuards,
  rejectManualClosureRequest
);

module.exports = router;
