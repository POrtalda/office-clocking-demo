// Independent remote profile. This never authorizes the local GPS bypass.
const DATABASE = "office_clocking_showcase_20261113";
const PURPOSE = "office-clocking-remote-20261113";
const ADMIN = "showcase_admin";
const ISSUER = "office-clocking-showcase-20261113";
function isRemoteShowcase(env = process.env) { return env.APP_ENV === "showcase"; }
function httpsOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash || !url.hostname.includes(".") || /(?:localhost|\.local|\.invalid|\.test)$/.test(url.hostname) || /^\d+(?:\.\d+){3}$/.test(url.hostname)) return null;
    return url.origin;
  } catch { return null; }
}
function assertAtlasTarget(uri, host) {
  let url;
  try { url = new URL(uri); } catch { throw new Error("Showcase: Atlas URI non valida"); }
  if (!host || !/^[a-z0-9][a-z0-9.-]+\.mongodb\.net$/.test(host) || url.protocol !== "mongodb+srv:" || url.hostname !== host || url.port || !url.username || !url.password || url.pathname !== `/${DATABASE}` || url.hash) throw new Error("Showcase: richiesto Atlas dedicato e database remoto esatto");
  for (const [key, value] of url.searchParams) {
    if (!({ retryWrites: ["true"], w: ["majority"], authSource: ["admin"] })[key]?.includes(value)) throw new Error("Showcase: opzioni Atlas non ammesse");
  }
  return DATABASE;
}
function assertRemoteShowcaseConfig(env = process.env) {
  if (!isRemoteShowcase(env) || env.NODE_ENV !== "production" || env.DEMO_MODE !== "true" || env.DEMO_LOCAL_GPS_BYPASS !== "false" || env.GEOLOCATION_CLOCK_IN_ENABLED !== "true" || env.SHOWCASE_EMAIL_MODE !== "disabled" || env.SHOWCASE_ADMIN_USERNAME !== ADMIN) throw new Error("Showcase: profilo remoto incompleto o non sicuro");
  if (env.SHOWCASE_GPS_CHECK_DISABLED !== undefined && !["true", "false"].includes(env.SHOWCASE_GPS_CHECK_DISABLED)) throw new Error("Showcase: flag GPS remoto non valido");
  const client = httpsOrigin(env.CLIENT_URL), api = httpsOrigin(env.SHOWCASE_API_URL);
  if (!client || !api || client === api) throw new Error("Showcase: richieste due origini HTTPS distinte ed esatte");
  if (!/^[a-f0-9]{64,128}$/.test(env.JWT_SECRET || "") || new Set(env.JWT_SECRET).size < 10) throw new Error("Showcase: generare una chiave JWT casuale dedicata di almeno 32 byte hex");
  if (Object.keys(env).some(key => key.startsWith("SMTP_") && env[key])) throw new Error("Showcase: rimuovere tutte le configurazioni SMTP");
  assertAtlasTarget(env.MONGO_URI, env.SHOWCASE_ATLAS_HOST);
  const lat = Number(env.OFFICE_LAT), lng = Number(env.OFFICE_LNG), radius = Number(env.OFFICE_RADIUS_METERS);
  if (!env.OFFICE_LAT || !env.OFFICE_LNG || !Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180 || !Number.isFinite(radius) || radius < 1 || radius > 1000) throw new Error("Showcase: configurare la sede reale e un raggio da 1 a 1000 metri");
  return { client, api, database: DATABASE };
}
function canUseRemoteShowcaseGps(req, env = process.env) {
  if (env.SHOWCASE_GPS_CHECK_DISABLED !== "true") return false;
  try {
    const { client, api } = assertRemoteShowcaseConfig(env);
    return req?.secure === true && req.hostname === new URL(api).hostname && req.headers?.origin === client;
  } catch { return false; }
}
function jwtOptions(env = process.env) { return { algorithm: "HS256", expiresIn: "1h", issuer: ISSUER, audience: httpsOrigin(env.CLIENT_URL) }; }
function jwtVerification(env = process.env) { return { algorithms: ["HS256"], issuer: ISSUER, audience: httpsOrigin(env.CLIENT_URL) }; }
function strongDemoPassword(password) {
  return typeof password === "string" && password.length >= 24 && password.length <= 128 && new Set(password).size >= 10;
}
module.exports = { canUseRemoteShowcaseGps, DATABASE, PURPOSE, ADMIN, ISSUER, isRemoteShowcase, httpsOrigin, assertAtlasTarget, assertRemoteShowcaseConfig, jwtOptions, jwtVerification, strongDemoPassword };
