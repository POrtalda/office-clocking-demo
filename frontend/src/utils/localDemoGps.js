const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
export function isLocalDemoGpsCandidate(env, hostname) {
  if (env.DEV !== true || env.MODE !== "demo-local" || env.VITE_DEMO_MODE !== "true" ||
      env.VITE_DEMO_LOCAL_GPS_BYPASS !== "true" || !loopbackHosts.has(hostname)) return false;
  try {
    const api = new URL(env.VITE_API_URL);
    return api.protocol === "http:" && loopbackHosts.has(api.hostname) && !api.username && !api.password &&
      api.pathname === "/" && !api.search && !api.hash;
  } catch { return false; }
}

export async function getClockLocationPayload({ allowWithoutGps, requestPosition }) {
  if (allowWithoutGps === true) return { demoWithoutGps: true };
  const position = await requestPosition();
  return { location: { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy } };
}

export function getOffsiteClockPayload(reason) {
  if (typeof reason !== "string" || !reason.trim() || reason.trim().length > 500) {
    const error = new Error("Inserisci una motivazione fuori sede da 1 a 500 caratteri.");
    error.code = "OFFSITE_REASON_REQUIRED";
    throw error;
  }
  return { workLocation: "offsite", offsiteReason: reason.trim() };
}
