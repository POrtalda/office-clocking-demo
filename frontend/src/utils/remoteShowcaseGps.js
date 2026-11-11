import { getClockLocationPayload } from "./localDemoGps.js";

// A build flag only allows querying policy; the server remains the authority.
export function isRemoteShowcaseGpsCandidate(env, protocol) {
  return env.MODE === "showcase-remote" && env.VITE_SHOWCASE_REMOTE === "true" &&
    env.VITE_DEMO_MODE === "true" && env.VITE_DEMO_LOCAL_GPS_BYPASS === "false" && protocol === "https:";
}
export function acceptsRemoteGpsPolicy(policy, candidate) {
  return candidate === true && policy?.canSkipShowcaseGps === true;
}
export async function getRemoteClockLocationPayload({ authorized, requestPosition }) {
  if (authorized === true) return { showcaseWithoutGps: true };
  return getClockLocationPayload({ allowWithoutGps: false, requestPosition });
}
export const REMOTE_GPS_NOTICE = "Demo online: controllo GPS disattivato per entrata, uscita e pause. Nessuna coordinata viene generata. Il controllo della sede tramite GPS è disponibile nella versione aziendale.";
