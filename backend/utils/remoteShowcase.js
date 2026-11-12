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
const RUNTIME_KEYS = ["APP_ENV","NODE_ENV","DEMO_MODE","DEMO_LOCAL_GPS_BYPASS","GEOLOCATION_CLOCK_IN_ENABLED","SHOWCASE_EMAIL_MODE","SHOWCASE_ADMIN_USERNAME","CLIENT_URL","SHOWCASE_API_URL","SHOWCASE_ATLAS_HOST","MONGO_URI","JWT_SECRET","OFFICE_LAT","OFFICE_LNG","OFFICE_RADIUS_METERS"];
const CONFIG_CATEGORIES = new Set([...RUNTIME_KEYS.map(key=>`MISSING_${key}`),...RUNTIME_KEYS.map(key=>`INVALID_${key}`),"GPS_FLAG_INVALID","ORIGINS_INVALID","JWT_SECRET_INVALID","SMTP_NOT_ALLOWED","ATLAS_TARGET_INVALID","OFFICE_LOCATION_INVALID"]);
function invalidConfig(category) {
  const error=new Error("Configurazione Showcase non valida");
  error.showcaseConfigCategory=category;
  return error;
}
function safeConfigCategory(error) {return CONFIG_CATEGORIES.has(error?.showcaseConfigCategory)?error.showcaseConfigCategory:"CONFIGURATION_INVALID";}
function assertRemoteShowcaseConfig(env = process.env) {
  for(const key of RUNTIME_KEYS)if(!env[key])throw invalidConfig(`MISSING_${key}`);
  const flags={APP_ENV:"showcase",NODE_ENV:"production",DEMO_MODE:"true",DEMO_LOCAL_GPS_BYPASS:"false",GEOLOCATION_CLOCK_IN_ENABLED:"true",SHOWCASE_EMAIL_MODE:"disabled",SHOWCASE_ADMIN_USERNAME:ADMIN};
  for(const [key,value] of Object.entries(flags))if(env[key]!==value)throw invalidConfig(`INVALID_${key}`);
  if (env.SHOWCASE_GPS_CHECK_DISABLED !== undefined && !["true", "false"].includes(env.SHOWCASE_GPS_CHECK_DISABLED)) throw invalidConfig("GPS_FLAG_INVALID");
  const client = httpsOrigin(env.CLIENT_URL), api = httpsOrigin(env.SHOWCASE_API_URL);
  if (!client || !api || client === api) throw invalidConfig("ORIGINS_INVALID");
  if (!/^[a-f0-9]{64,128}$/.test(env.JWT_SECRET || "") || new Set(env.JWT_SECRET).size < 10) throw invalidConfig("JWT_SECRET_INVALID");
  if (Object.keys(env).some(key => key.startsWith("SMTP_") && env[key])) throw invalidConfig("SMTP_NOT_ALLOWED");
  try {assertAtlasTarget(env.MONGO_URI, env.SHOWCASE_ATLAS_HOST);}catch{throw invalidConfig("ATLAS_TARGET_INVALID");}
  const lat = Number(env.OFFICE_LAT), lng = Number(env.OFFICE_LNG), radius = Number(env.OFFICE_RADIUS_METERS);
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180 || !Number.isFinite(radius) || radius < 1 || radius > 1000) throw invalidConfig("OFFICE_LOCATION_INVALID");
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
module.exports = { safeConfigCategory, canUseRemoteShowcaseGps, DATABASE, PURPOSE, ADMIN, ISSUER, isRemoteShowcase, httpsOrigin, assertAtlasTarget, assertRemoteShowcaseConfig, jwtOptions, jwtVerification, strongDemoPassword };
