const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
function isLoopbackUrl(value, protocol = "http:") {
  try {
    const url = new URL(value);
    return url.protocol === protocol && LOOPBACK_HOSTS.has(url.hostname) &&
      !url.username && !url.password && !url.search && !url.hash && url.pathname === "/";
  } catch (_) { return false; }
}
function isLocalShowcaseEnvironment(env = process.env) {
  if (env.NODE_ENV !== "development" || env.DEMO_MODE !== "true" || env.DEMO_LOCAL_GPS_BYPASS !== "true") return false;
  try {
    const uri = new URL(env.MONGO_URI);
    return uri.protocol === "mongodb:" && LOOPBACK_HOSTS.has(uri.hostname) &&
      uri.pathname === "/office_clocking_showcase_v2";
  } catch (_) { return false; }
}
function canUseLocalDemoGps(req, env = process.env) {
  if (!isLocalShowcaseEnvironment(env)) return false;
  const remote = req.socket?.remoteAddress;
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote)) return false;
  const headers = req.headers || {};
  // Never trust forwarded addresses or a proxy to enable this exception.
  if (Object.keys(headers).some(key => key.toLowerCase() === "forwarded" || key.toLowerCase().startsWith("x-forwarded-"))) return false;
  if (!isLoopbackUrl(`http://${headers.host}`)) return false;
  return !headers.origin || isLoopbackUrl(headers.origin);
}
module.exports = { canUseLocalDemoGps, isLocalShowcaseEnvironment, isLoopbackUrl };
