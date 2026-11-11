// No dotenv: only the new service's explicit environment is accepted.
const { assertRemoteShowcaseConfig, DATABASE, PURPOSE } = require("../utils/remoteShowcase");
async function start() {
  assertRemoteShowcaseConfig();
  if (process.argv.includes("--check")) { console.log("Configurazione Showcase remoto valida; nessuna connessione aperta."); return; }
  const mongoose = require("mongoose");
  mongoose.set("autoIndex", false); mongoose.set("autoCreate", false);
  const port = Number(process.env.PORT || 10000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Porta non valida");
  try {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DATABASE, autoIndex: false, autoCreate: false, maxPoolSize: 10, serverSelectionTimeoutMS: 10000 });
  const guard = await mongoose.connection.db.collection("_showcase_guard").findOne({ _id: PURPOSE, state: "ready" });
  if (!guard) { await mongoose.disconnect(); throw new Error("Database Showcase non inizializzato o seed incompleto"); }
  const app = require("../app");
  const server = app.listen(port, "0.0.0.0", () => console.log("Office Clocking Showcase remoto avviato; email disabilitate."));
  process.once("SIGTERM", () => { server.close(() => { mongoose.disconnect().then(() => process.exit(0)); }); });
  } catch (error) { await mongoose.disconnect(); throw error; }
}
if (require.main === module) start().catch(() => { console.error("Avvio Showcase bloccato: controllare configurazione, rete Atlas e inizializzazione. Nessun segreto viene stampato."); process.exitCode = 1; });
module.exports = { start };
