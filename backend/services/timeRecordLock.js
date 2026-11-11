
const { randomUUID } = require("crypto");
const TimeRecordLock = require("../models/TimeRecordLock");

const LOCK_DURATION_MS = 60000;
const RETRY_DELAY_MS = 100;
const MAX_WAIT_MS = 5000;
const RENEW_INTERVAL_MS = 20000;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Acquisisce un blocco esclusivo per dipendente.
 *
 * Usa l'atomicità di MongoDB sul singolo documento.
 * Può funzionare anche su MongoDB standalone.
 */
async function acquireTimeRecordLock(userId) {
    const owner = randomUUID();
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_WAIT_MS) {
        const now = new Date();

        try {
            const result = await TimeRecordLock.findOneAndUpdate(
                {
                    _id: userId,
                    $or: [
                        { owner: null },
                        { lockedUntil: { $lte: now } },
                    ],
                },
                {
                    $set: {
                        owner,
                        lockedUntil: new Date(
                            now.getTime() + LOCK_DURATION_MS
                        ),
                    },
                },
                {
                    upsert: true,
                    returnDocument: "after",
                    lean: true,
                }
            );

            if (result && result.owner === owner) {
                return owner;
            }
        } catch (error) {
            // Un altro processo potrebbe aver creato
            // il documento di blocco nello stesso istante.
            // In quel caso attendiamo e riproviamo.
            if (error.code !== 11000) {
                throw error;
            }
        }

        await sleep(RETRY_DELAY_MS);
    }

    const error = new Error(
        "Un'altra operazione sulle timbrature è in corso. Riprova tra qualche secondo."
    );

    error.statusCode = 409;
    error.code = "TIME_RECORD_LOCK_BUSY";

    throw error;
}

/**
 * Rinnova il blocco soltanto se appartiene
 * ancora alla richiesta corrente.
 */
async function renewTimeRecordLock(userId, owner) {
    const result = await TimeRecordLock.updateOne(
        {
            _id: userId,
            owner,
            lockedUntil: { $gt: new Date() },
        },
        {
            $set: {
                lockedUntil: new Date(Date.now() + LOCK_DURATION_MS),
            },
        }
    );

    return result.matchedCount === 1;
}

/**
 * Rilascia il blocco soltanto se l'identificativo
 * del proprietario corrisponde.
 */
async function releaseTimeRecordLock(userId, owner) {
    await TimeRecordLock.updateOne(
        {
            _id: userId,
            owner,
        },
        {
            $set: {
                owner: null,
                lockedUntil: null,
            },
        }
    );
}

/**
 * Verifica che la richiesta possieda ancora
 * un blocco valido.
 */
async function ownsTimeRecordLock(userId, owner) {
    const lock = await TimeRecordLock.findOne({
        _id: userId,
        owner,
        lockedUntil: { $gt: new Date() },
    }).lean();

    return Boolean(lock);
}

function expiredLockError() {
    const error = new Error(
        "Il blocco della timbratura non è più valido. Riprova."
    );
    error.statusCode = 409;
    error.code = "TIME_RECORD_LOCK_EXPIRED";
    return error;
}

/**
 * Mantiene viva una lease durante le operazioni asincrone. Se il rinnovo
 * fallisce, le successive verifiche interrompono l'operazione.
 * Non sostituisce transazioni/fencing atomico sui documenti TimeRecord.
 */
function startTimeRecordLockHeartbeat(userId, owner) {
    let failed = false;
    let active = true;
    let pending = Promise.resolve();

    const renew = async () => {
        if (!active || failed) return;
        try {
            if (!(await renewTimeRecordLock(userId, owner))) {
                failed = true;
            }
        } catch (error) {
            failed = true;
        }
    };

    const timer = setInterval(() => {
        pending = pending.then(renew);
    }, RENEW_INTERVAL_MS);
    timer.unref?.();

    return {
        async assertActive() {
            if (failed) throw expiredLockError();
            await pending;
            if (failed || !(await renewTimeRecordLock(userId, owner))) {
                failed = true;
                throw expiredLockError();
            }
        },
        async stop() {
            active = false;
            clearInterval(timer);
            await pending;
        },
    };
}

/**
 * Esegue un'operazione protetta dal medesimo lock usato
 * dalle correzioni Admin. La callback deve rileggere
 * i dati che usa per decidere il salvataggio.
 */
async function withTimeRecordLock(userId, operation) {
    const owner = await acquireTimeRecordLock(userId);
    const heartbeat = startTimeRecordLockHeartbeat(userId, owner);
    try {
        return await operation(owner, heartbeat.assertActive);
    } finally {
        await heartbeat.stop();
        await releaseTimeRecordLock(userId, owner);
    }
}

module.exports = {
    acquireTimeRecordLock,
    renewTimeRecordLock,
    releaseTimeRecordLock,
    ownsTimeRecordLock,
    withTimeRecordLock,
    startTimeRecordLockHeartbeat,
};
