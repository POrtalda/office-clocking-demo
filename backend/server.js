/**
 * server.js
 *
 * Punto di ingresso reale del backend Office Clocking.
 *
 * Responsabilità:
 * - caricare le variabili ambiente
 * - leggere le configurazioni essenziali
 * - connettersi a MongoDB
 * - avviare il server HTTP
 *
 * Tutta la configurazione Express è stata spostata in app.js
 * così l'app può essere importata nei test senza aprire una porta.
 */

require("dotenv").config();

const mongoose = require("mongoose");
const app = require("./app");

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const CLIENT_URL = process.env.CLIENT_URL || "";

// ============================================================================
// CONTROLLI VARIABILI AMBIENTE
// ============================================================================

if (!MONGO_URI) {
  console.error("Variabile MONGO_URI mancante nel file .env");
  process.exit(1);
}

if (!CLIENT_URL) {
  console.warn("Variabile CLIENT_URL non impostata");
}

// ============================================================================
// PREPARAZIONE LOG ORIGIN CONSENTITI
// ============================================================================

const allowedOrigins = CLIENT_URL.split(",")
  .map((url) => url.trim().replace(/\/$/, ""))
  .filter(Boolean);

// ============================================================================
// AVVIO SERVER
// ============================================================================

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connesso ✅");

    app.listen(PORT, () => {
      console.log(`Server attivo su http://localhost:${PORT} 🚀`);
      if (allowedOrigins.length > 0) {
        console.log(`CORS consentito per: ${allowedOrigins.join(", ")}`);
      }
    });
  })
  .catch((err) => {
    console.error("Errore connessione MongoDB:", err);
    process.exit(1);
  });