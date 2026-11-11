
const mongoose = require("mongoose");

/**
 * Documento di coordinamento delle operazioni
 * sulle timbrature di un singolo dipendente.
 */
const timeRecordLockSchema = new mongoose.Schema(
    {
        // Un documento per ciascun dipendente.
        _id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // Identificativo della richiesta proprietaria.
        owner: {
            type: String,
            default: null,
        },

        // Scadenza del blocco.
        lockedUntil: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

module.exports = mongoose.model(
    "TimeRecordLock",
    timeRecordLockSchema
);
