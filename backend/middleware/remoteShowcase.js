const rateLimit = require("express-rate-limit");
const { isRemoteShowcase, assertRemoteShowcaseConfig } = require("../utils/remoteShowcase");
function installRemoteShowcase(app) {
  if (!isRemoteShowcase()) return;
  const { client, api } = assertRemoteShowcaseConfig();
  // Render internal readiness probes do not carry browser/proxy headers. No user data.
  app.get("/healthz", (_req,res) => { res.set("Cache-Control","no-store"); const ready = require("mongoose").connection.readyState === 1; return res.status(ready ? 200 : 503).json({ service: "Office Clocking Showcase", ready }); });
  app.use((req, res, next) => {
    if (!req.secure || req.hostname !== new URL(api).hostname) return res.status(400).json({ code: "SHOWCASE_HTTPS_REQUIRED", message: "Usa l'URL HTTPS dello Showcase" });
    res.set("Cache-Control", "no-store");
    res.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    const origin = req.get("Origin");
    if ((origin && origin !== client) || (!["GET", "HEAD", "OPTIONS"].includes(req.method) && origin !== client)) return res.status(403).json({ code: "SHOWCASE_ORIGIN_DENIED", message: "Origine non autorizzata" });
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && /^\/api\/admin\/(?:users|settings)(?:\/|$)/i.test(req.path)) return res.status(403).json({ code: "SHOWCASE_READ_ONLY_SETTINGS", message: "Gestione account e impostazioni bloccata nello Showcase" });
    next();
  });
  // Account limit remains active too. Single-instance service; memory counters reset on restart.
  app.use("/api/auth/login", rateLimit({ windowMs: 10 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { code: "SHOWCASE_LOGIN_LIMIT", message: "Troppi tentativi da questa connessione", retryAfterSeconds: 600 } }));
}
module.exports = { installRemoteShowcase };
