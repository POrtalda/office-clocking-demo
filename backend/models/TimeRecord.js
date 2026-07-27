/**
 * models/TimeRecord.js
 *
 * Modello principale delle timbrature di Office Clocking.
 *
 * Ogni documento rappresenta una singola sessione di lavoro:
 * - clock-in (entrata)
 * - clock-out (uscita)
 * - durata totale in secondi
 * - stato del record
 *
 * Supporta anche il flusso di chiusura manuale:
 * se il dipendente dimentica il clock-out,
 * può inviare una richiesta da sottoporre all'admin.
 */

const mongoose = require("mongoose");

// ============================================================================
// SOTTOSCHEMA: MANUAL CLOSURE REQUEST
// ============================================================================

/**
 * Dati relativi alla richiesta di chiusura manuale.
 *
 * Questo sottoschema viene incorporato direttamente nel record
 * e non ha un proprio _id separato.
 */
const manualClosureRequestSchema = new mongoose.Schema(
  {
    /**
     * Orario di uscita proposto dal dipendente.
     * Resta null se non esiste una richiesta attiva.
     */
    proposedClockOut: {
      type: Date,
      default: null,
    },

    /**
     * Nota facoltativa del dipendente.
     */
    note: {
      type: String,
      trim: true,
      default: "",
    },

    /**
     * Data/ora di invio della richiesta manuale.
     */
    requestedAt: {
      type: Date,
      default: null,
    },

    /**
     * Data/ora in cui l'admin ha revisionato la richiesta.
     * Viene valorizzata sia in caso di approvazione sia di rifiuto.
     */
    reviewedAt: {
      type: Date,
      default: null,
    },

    /**
     * Admin che ha revisionato la richiesta.
     */
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /**
     * Nota lasciata dall'admin durante la revisione.
     */
    reviewNote: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: false,
  }
);

// ============================================================================
// SOTTOSCHEMA: RECORD CANCELLATION
// ============================================================================

/**
 * Dati relativi all'annullamento logico di una timbratura.
 *
 * L'annullamento non elimina fisicamente il record:
 * mantiene audit trail e motivazione admin.
 */
const cancellationSchema = new mongoose.Schema(
  {
    /**
     * Data/ora in cui l'admin ha annullato la timbratura.
     */
    cancelledAt: {
      type: Date,
      default: null,
    },

    /**
     * Admin che ha annullato la timbratura.
     */
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /**
     * Motivazione obbligatoria inserita dall'admin.
     */
    cancelReason: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: false,
  }
);

// ============================================================================
// SOTTOSCHEMA: CLOCK LOCATION
// ============================================================================

/**
 * Dati di validazione geolocalizzata di una timbratura.
 *
 * Vengono salvati solo quando la geolocalizzazione è attiva
 * e la timbratura viene accettata.
 */
const clockLocationSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      default: null,
    },

    longitude: {
      type: Number,
      default: null,
    },

    accuracy: {
      type: Number,
      default: null,
    },

    distanceMeters: {
      type: Number,
      default: null,
      min: 0,
    },

    radiusMeters: {
      type: Number,
      default: null,
      min: 0,
    },

    validatedAt: {
      type: Date,
      default: null,
    },

    validationStatus: {
      type: String,
      enum: ["passed"],
      default: null,
    },
  },
  {
    _id: false,
  }
);

// ============================================================================
// SCHEMA PRINCIPALE TIMBRATURA
// ============================================================================

/**
 * Schema principale di una timbratura.
 *
 * Stati supportati:
 * - open
 * - closed
 * - pending_manual_closure
 * - manual_closure_rejected
 * - cancelled
 */
const timeRecordSchema = new mongoose.Schema(
  {
    /**
     * Utente proprietario della timbratura.
     */
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    /**
     * Momento di entrata.
     */
    clockIn: {
      type: Date,
      required: true,
    },

    /**
     * Momento di uscita.
     * Resta null finché il record è aperto o in attesa di chiusura manuale.
     */
    clockOut: {
      type: Date,
      default: null,
    },

    /**
     * Durata totale della sessione in secondi.
     * Nei record aperti normalmente resta 0.
     */
    durationSec: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Stato operativo del record.
     */
    status: {
      type: String,
      enum: [
        "open",
        "closed",
        "pending_manual_closure",
        "manual_closure_rejected",
        "cancelled",
      ],
      default: "open",
    },

    /**
     * Dati geolocalizzazione usati per validare l'entrata.
     * Resta null se la geolocalizzazione è disattivata.
     */
    clockInLocation: {
      type: clockLocationSchema,
      default: null,
    },

    /**
     * Dati geolocalizzazione usati per validare l'uscita.
     * Resta null se la geolocalizzazione è disattivata.
     */
    clockOutLocation: {
      type: clockLocationSchema,
      default: null,
    },

    /**
     * Dati della richiesta di chiusura manuale.
     * Sempre presente come sottostruttura, anche se inizialmente vuota.
     */
    manualClosureRequest: {
      type: manualClosureRequestSchema,
      default: () => ({}),
    },

    /**
     * Dati di annullamento logico della timbratura.
     * Valorizzato solo quando status === "cancelled".
     */
    cancellation: {
      type: cancellationSchema,
      default: () => ({}),
    },
  },
  {
    // createdAt e updatedAt utili per audit, debug e storico modifiche
    timestamps: true,
  }
);

// ============================================================================
// INDICI
// ============================================================================

/**
 * Indice utile per:
 * - storico utente
 * - query dei record recenti
 * - ordinamento per entrata
 */
timeRecordSchema.index({ user: 1, clockIn: -1 });

/**
 * Indice utile per:
 * - recuperare rapidamente record aperti
 * - individuare anomalie
 * - supportare i controlli sullo stato operativo
 */
timeRecordSchema.index({ user: 1, clockOut: 1, status: 1, clockIn: -1 });

// ============================================================================
// EXPORT MODEL
// ============================================================================

module.exports = mongoose.model("TimeRecord", timeRecordSchema);
