const rateLimit = require("express-rate-limit");

const LOGIN_WINDOW_MS = 10 * 60 * 1000; // 10 minuti

const loginLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,

  // Limite per username normalizzato
  keyGenerator: (req) => {
    const username = String(req.body?.username || "")
      .trim()
      .toLowerCase();

    return username || "unknown-username";
  },

  // Quando scatta il blocco, restituisco anche i secondi residui
  handler: (req, res, next, options) => {
    let retryAfterSeconds = Math.ceil(LOGIN_WINDOW_MS / 1000);

    if (req.rateLimit?.resetTime instanceof Date) {
      const diffMs = req.rateLimit.resetTime.getTime() - Date.now();
      retryAfterSeconds = Math.ceil(diffMs / 1000);
    }

    if (!Number.isFinite(retryAfterSeconds) || retryAfterSeconds < 1) {
      retryAfterSeconds = Math.ceil(LOGIN_WINDOW_MS / 1000);
    }

    // Header utile per il frontend
    res.set("Retry-After", String(retryAfterSeconds));

    return res.status(options.statusCode).json({
      message:
        "Troppi tentativi di login per questo username. Riprova più tardi.",
      retryAfterSeconds,
    });
  },
});

module.exports = { loginLimiter };