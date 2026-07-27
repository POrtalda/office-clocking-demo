/**
 * app.js
 *
 * Crea e configura l'app Express di Office Clocking.
 *
 * Responsabilità:
 * - creare l'istanza Express
 * - configurare middleware globali
 * - configurare CORS
 * - applicare il rate limit generale
 * - montare le route principali
 * - gestire route non trovate ed errori globali
 *
 * Importante:
 * questo file NON avvia il server HTTP
 * e NON apre la connessione a MongoDB.
 *
 * In questo modo:
 * - server.js si occupa del bootstrap reale
 * - i test possono importare l'app senza fare app.listen()
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const authRouter = require("./routes/auth");
const recordsRouter = require("./routes/records");
const adminRouter = require("./routes/admin");
const leaveRouter = require("./routes/leaveRoutes");

const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const settingsRoutes = require("./routes/settings");

const demoRoutes = require("./routes/demo");

const app = express();

// ============================================================================
// CONFIG BASE
// ============================================================================

// Utile se l'app gira dietro proxy / reverse proxy / hosting
app.set("trust proxy", 1);

const CLIENT_URL = process.env.CLIENT_URL || "";
const IS_TEST = process.env.NODE_ENV === "test";

// ============================================================================
// CONTROLLI VARIABILI AMBIENTE
// ============================================================================

if (!CLIENT_URL && !IS_TEST) {
  console.warn("Variabile CLIENT_URL non impostata");
}

// ============================================================================
// PREPARAZIONE ORIGIN CONSENTITI PER CORS
// ============================================================================

/**
 * CLIENT_URL può contenere:
 * - un solo URL, es.:
 *   https://office-clocking.netlify.app
 *
 * - oppure più URL separati da virgola, es.:
 *   https://office-clocking.netlify.app,https://deploy-preview.netlify.app
 *
 * Ogni URL viene:
 * - trimmato
 * - normalizzato togliendo l'eventuale slash finale
 */
const allowedOrigins = CLIENT_URL.split(",")
  .map((url) => url.trim().replace(/\/$/, ""))
  .filter(Boolean);

if (!IS_TEST) {
  console.log("CLIENT_URL raw:", CLIENT_URL);
  console.log("Allowed origins:", allowedOrigins);
}

// ============================================================================
// MIDDLEWARE GLOBALI
// ============================================================================

// Header HTTP di sicurezza
app.use(helmet());

/**
 * CORS:
 * - consente gli origin dichiarati in CLIENT_URL
 * - consente richieste senza origin (Postman, health check, test, server-to-server)
 * - supporta più URL separati da virgola
 *
 * Nota:
 * il browser invia come origin solo schema + dominio (+ porta),
 * ad esempio:
 *   https://office-clocking.netlify.app
 *
 * NON invia route come /login o /home-user
 */
app.use(
  cors({
    origin(origin, callback) {
      // Richieste senza origin:
      // - Postman
      // - health check
      // - test automatici
      // - chiamate server-to-server
      if (!origin) {
        return callback(null, true);
      }

      // Normalizzo l'origin ricevuto togliendo eventuale slash finale
      const normalizedOrigin = origin.trim().replace(/\/$/, "");

      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      // Log utile per debug in produzione
      if (!IS_TEST) {
        console.log("Origin bloccato dal CORS:", normalizedOrigin);
        console.log("Allowed origins:", allowedOrigins);
      }

      return callback(new Error("Origin non autorizzato dal CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
    optionsSuccessStatus: 204,
  })
);

// Parsing body JSON
app.use(express.json());

// ============================================================================
// RATE LIMIT GLOBALE API
// ============================================================================

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 300, // max richieste per IP nella finestra
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Troppe richieste, riprova più tardi",
    code: "TOO_MANY_REQUESTS",
  },
});

app.use("/api", apiLimiter);
app.use("/api/demo", demoRoutes);

app.use("/api/auth", authRouter);
app.use("/api/records", recordsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/leaves", leaveRouter);

app.use("/api/settings", settingsRoutes);

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get("/", (req, res) => {
  return res.status(200).json({
    message: "Office Clocking API attiva",
  });
});

// ============================================================================
// ROUTE PRINCIPALI
// ============================================================================

app.use("/api/auth", authRouter);
app.use("/api/records", recordsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/leaves", leaveRouter);

// ============================================================================
// HANDLER FINALI
// ============================================================================

// Route inesistenti
app.use(notFound);

// Gestione errori globale
app.use(errorHandler);

module.exports = app;