/**
 * scripts/migrateLegacyRecordStatuses.js
 *
 * Script di migrazione legacy per riallineare gli status dei TimeRecord.
 *
 * OBIETTIVO
 * Sistemare i record storici che possono avere:
 * - status mancante
 * - status incoerente
 * - durationSec mancante/non coerente su record chiusi
 *
 * REGOLE APPLICATE
 *
 * 1) Se clockOut esiste:
 *    -> status = "closed"
 *
 * 2) Se clockOut NON esiste e c'è una richiesta manuale NON revisionata:
 *    -> status = "pending_manual_closure"
 *
 * 3) Se clockOut NON esiste e c'è una richiesta manuale revisionata:
 *    -> status = "manual_closure_rejected"
 *
 * 4) Se clockOut NON esiste e non c'è richiesta manuale:
 *    -> status = "open"
 *
 * NOTA IMPORTANTE
 * Questo script NON può capire da solo eventuali incoerenze semantiche
 * tipo:
 * - record chiuso ma con reviewNote “da rifiuto”
 * perché in presenza di clockOut prevale il fatto che il record è chiuso.
 *
 * USO
 *
 * Dry run (consigliato prima):
 *   node scripts/migrateLegacyRecordStatuses.js --dry-run
 *
 * Esecuzione reale:
 *   node scripts/migrateLegacyRecordStatuses.js
 *
 * PREREQUISITI
 * - deve esistere MONGO_URI nel file .env
 * - eseguire dalla root del backend
 */

const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const mongoose = require("mongoose");
const TimeRecord = require("../models/TimeRecord");

// ============================================================================
// CONFIG
// ============================================================================

const MONGO_URI = process.env.MONGO_URI;
const DRY_RUN = process.argv.includes("--dry-run");

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calcola la durata in secondi tra due date.
 * Ritorna 0 se il risultato fosse negativo o invalido.
 */
function calcDurationSec(clockIn, clockOut) {
  const startMs = new Date(clockIn).getTime();
  const endMs = new Date(clockOut).getTime();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;

  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

/**
 * Verifica se il record contiene tracce di richiesta manuale.
 */
function hasManualClosureRequest(record) {
  const req = record?.manualClosureRequest;
  if (!req) return false;

  return Boolean(
    req.proposedClockOut ||
      req.requestedAt ||
      req.reviewedAt ||
      req.reviewedBy ||
      (typeof req.reviewNote === "string" && req.reviewNote.trim() !== "") ||
      (typeof req.note === "string" && req.note.trim() !== "")
  );
}

/**
 * Verifica se la richiesta manuale è stata revisionata da un admin.
 */
function hasReviewedManualClosure(record) {
  return Boolean(record?.manualClosureRequest?.reviewedAt);
}

/**
 * Ricava lo status corretto da assegnare al record.
 */
function getExpectedStatus(record) {
  // Regola forte: se esiste clockOut, il record è chiuso
  if (record.clockOut) return "closed";

  const hasRequest = hasManualClosureRequest(record);

  if (!hasRequest) {
    return "open";
  }

  if (hasReviewedManualClosure(record)) {
    return "manual_closure_rejected";
  }

  return "pending_manual_closure";
}

/**
 * Verifica se durationSec va ricalcolato.
 *
 * La ricalcoliamo solo per record chiusi:
 * - se manca
 * - se non è un numero valido
 * - se è negativa
 */
function shouldRecalculateDuration(record, expectedStatus) {
  if (expectedStatus !== "closed") return false;
  if (!record.clockIn || !record.clockOut) return false;

  return !(
    typeof record.durationSec === "number" &&
    Number.isFinite(record.durationSec) &&
    record.durationSec >= 0
  );
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI mancante nel file .env");
  }

  await mongoose.connect(MONGO_URI);
  console.log("Connesso a MongoDB");

  const records = await TimeRecord.find({}).sort({ createdAt: 1 });

  console.log(`Record trovati: ${records.length}`);
  console.log(DRY_RUN ? "Modalità: DRY RUN" : "Modalità: ESECUZIONE REALE");
  console.log("------------------------------------------------------------");

  let scanned = 0;
  let changed = 0;
  let unchanged = 0;

  let statusUpdatedCount = 0;
  let durationUpdatedCount = 0;

  const statusCounters = {
    open: 0,
    closed: 0,
    pending_manual_closure: 0,
    manual_closure_rejected: 0,
  };

  for (const record of records) {
    scanned += 1;

    const currentStatus = String(record.status || "").trim();
    const expectedStatus = getExpectedStatus(record);

    const needsStatusUpdate = currentStatus !== expectedStatus;
    const needsDurationUpdate = shouldRecalculateDuration(record, expectedStatus);

    if (!needsStatusUpdate && !needsDurationUpdate) {
      unchanged += 1;
      statusCounters[expectedStatus] += 1;
      continue;
    }

    changed += 1;

    const changes = [];

    if (needsStatusUpdate) {
      changes.push(`status: "${currentStatus || "(vuoto)"}" -> "${expectedStatus}"`);
    }

    if (needsDurationUpdate) {
      const newDurationSec = calcDurationSec(record.clockIn, record.clockOut);
      changes.push(
        `durationSec: "${record.durationSec ?? "(vuoto)"}" -> "${newDurationSec}"`
      );
    }

    console.log(`[${record._id}] ${changes.join(" | ")}`);

    if (!DRY_RUN) {
      if (needsStatusUpdate) {
        record.status = expectedStatus;
        statusUpdatedCount += 1;
      }

      if (needsDurationUpdate) {
        record.durationSec = calcDurationSec(record.clockIn, record.clockOut);
        durationUpdatedCount += 1;
      }

      await record.save();
    } else {
      if (needsStatusUpdate) statusUpdatedCount += 1;
      if (needsDurationUpdate) durationUpdatedCount += 1;
    }

    statusCounters[expectedStatus] += 1;
  }

  console.log("------------------------------------------------------------");
  console.log("RIEPILOGO");
  console.log(`Scansionati: ${scanned}`);
  console.log(`Modificati: ${changed}`);
  console.log(`Invariati: ${unchanged}`);
  console.log(`Status aggiornati: ${statusUpdatedCount}`);
  console.log(`Duration aggiornate: ${durationUpdatedCount}`);
  console.log("Distribuzione status finale attesa:");
  console.log(`- open: ${statusCounters.open}`);
  console.log(`- closed: ${statusCounters.closed}`);
  console.log(`- pending_manual_closure: ${statusCounters.pending_manual_closure}`);
  console.log(`- manual_closure_rejected: ${statusCounters.manual_closure_rejected}`);

  await mongoose.disconnect();
  console.log("Disconnesso da MongoDB");
}

main().catch(async (err) => {
  console.error("Errore migrazione:", err.message);

  try {
    await mongoose.disconnect();
  } catch (_) {
    // niente
  }

  process.exit(1);
});