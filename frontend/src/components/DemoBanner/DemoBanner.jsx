import "./DemoBanner.css";

export default function DemoBanner() {
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

  if (!isDemoMode) {
    return null;
  }

  return (
    <div className="demo-banner" role="status" aria-label="Modalità demo">
      <strong>Modalità Demo</strong>
      <span>
        Questa versione usa dati dimostrativi. Alcune azioni sensibili sono
        disabilitate.
      </span>
    </div>
  );
}