import "./DemoBanner.css";
import { isLocalDemoGpsCandidate } from "../../utils/localDemoGps";

export default function DemoBanner() {
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

  if (!isDemoMode) {
    return null;
  }

  return (
    <div className="demo-banner" role="status" aria-label="Modalità demo">
      <strong>{isLocalDemoGpsCandidate(import.meta.env, window.location.hostname) ? "Modalità Demo locale" : "Modalità Demo"}</strong>
      <span>
        Questa versione usa dati dimostrativi. Alcune azioni sensibili sono
        disabilitate.
      </span>
    </div>
  );
}