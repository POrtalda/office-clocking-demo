const fs = require("fs");
const path = require("path");
const { randomBytes } = require("crypto");
const file = path.resolve(__dirname, "../.env.showcase.local");
if (fs.existsSync(file)) {
  console.log("Configurazione locale già presente: nessun file sovrascritto.");
} else {
  const example = fs.readFileSync(path.resolve(__dirname, "../config/showcase-local.example.txt"), "utf8");
  fs.writeFileSync(file, example.replace(/^JWT_SECRET=$/m, `JWT_SECRET=${randomBytes(48).toString("hex")}`), { flag: "wx" });
  console.log("Creata .env.showcase.local con JWT locale. Nessun accesso al database.");
}
