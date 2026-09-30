import { useRegisterSW } from "virtual:pwa-register/react";
import "./PwaUpdate.css";

export default function PwaUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,

    onRegisteredSW(swScriptUrl, registration) {
      if (!registration) {
        return;
      }

      // Controlla subito se esiste una nuova versione quando l'app viene aperta.
      registration.update().catch((error) => {
        console.error("Errore controllo aggiornamento PWA:", error);
      });
    },

    onRegisterError(error) {
      console.error("Errore registrazione service worker:", error);
    },
  });

  if (!needRefresh) {
    return null;
  }

  async function handleUpdate() {
    try {
      await updateServiceWorker(true);
    } catch (error) {
      console.error("Errore aggiornamento PWA:", error);
    }
  }

  function handleClose() {
    setNeedRefresh(false);
  }

  return (
    <aside
      className="pwa-update"
      role="status"
      aria-live="polite"
      aria-label="Aggiornamento disponibile"
    >
      <div className="pwa-update__content">
        <strong className="pwa-update__title">
          Nuova versione disponibile
        </strong>

        <p className="pwa-update__message">
          Aggiorna Office Clocking per usare l&apos;ultima versione.
        </p>
      </div>

      <div className="pwa-update__actions">
        <button
          className="pwa-update__button pwa-update__button--primary"
          type="button"
          onClick={handleUpdate}
        >
          Aggiorna
        </button>

        <button
          className="pwa-update__button pwa-update__button--secondary"
          type="button"
          onClick={handleClose}
        >
          Più tardi
        </button>
      </div>
    </aside>
  );
}
