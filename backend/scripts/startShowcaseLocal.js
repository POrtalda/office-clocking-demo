const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.showcase.local"), quiet: true });
const { isLocalShowcaseEnvironment, isLoopbackUrl } = require("../utils/localDemoGps");
if (!isLocalShowcaseEnvironment() || !process.env.JWT_SECRET ||
    process.env.CLIENT_URL !== "http://127.0.0.1:5175" || !isLoopbackUrl(process.env.CLIENT_URL) ||
    process.env.PORT !== "5055") {
  console.error("Configurazione demo locale non valida. Esegui npm run demo:configure e controlla .env.showcase.local e le variabili ereditate. Nessuna connessione aperta.");
  process.exit(1);
}
if (process.argv.includes("--check")) {
  console.log("Demo locale valida: backend 127.0.0.1:5055, frontend 127.0.0.1:5175, database office_clocking_showcase_v2. Nessuna connessione aperta.");
} else {
  const mongoose = require("mongoose");
  // Startup must not create collections or rebuild indexes in the existing demo DB.
  mongoose.set("autoIndex", false);
  mongoose.set("autoCreate", false);
  const app = require("../app");
  mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false })
    .then(() => app.listen(5055, "127.0.0.1", () => console.log("Modalità Demo locale: http://127.0.0.1:5055 — office_clocking_showcase_v2")))
    .catch(() => { console.error("Connessione al MongoDB locale non riuscita."); process.exitCode = 1; });
}
