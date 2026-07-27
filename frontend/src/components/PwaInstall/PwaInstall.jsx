import { useEffect, useState } from "react";
import "./PwaInstall.css";

function isStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isAppleMobileDevice() {
  const userAgent = window.navigator.userAgent.toLowerCase();

  const isIphoneOrIpad =
    /iphone|ipad|ipod/.test(userAgent);

  const isModernIpad =
    window.navigator.platform === "MacIntel" &&
    window.navigator.maxTouchPoints > 1;

  return isIphoneOrIpad || isModernIpad;
}

export default function PwaInstall() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(isStandaloneMode);
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  const isIos = isAppleMobileDevice();

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }

    function handleAppInstalled() {
      setIsInstalled(true);
      setInstallPrompt(null);
      setShowIosInstructions(false);
    }

    function handleDisplayModeChange(event) {
      if (event.matches) {
        setIsInstalled(true);
      }
    }

    const displayModeMediaQuery =
      window.matchMedia("(display-mode: standalone)");

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );

    window.addEventListener(
      "appinstalled",
      handleAppInstalled
    );

    displayModeMediaQuery.addEventListener?.(
      "change",
      handleDisplayModeChange
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );

      window.removeEventListener(
        "appinstalled",
        handleAppInstalled
      );

      displayModeMediaQuery.removeEventListener?.(
        "change",
        handleDisplayModeChange
      );
    };
  }, []);

  async function handleInstall() {
    if (isIos) {
      setShowIosInstructions(true);
      return;
    }

    if (!installPrompt) {
      return;
    }

    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch (error) {
      console.error("Errore durante l'installazione della PWA:", error);
    } finally {
      setInstallPrompt(null);
    }
  }

  if (isInstalled) {
    return null;
  }

  if (!installPrompt && !isIos) {
    return null;
  }

  return (
    <>
      <button
        className="pwa-install-button"
        type="button"
        onClick={handleInstall}
        aria-label="Installa Office Clocking"
      >
        <span aria-hidden="true">⬇</span>
        Installa app
      </button>

      {showIosInstructions && (
        <div
          className="pwa-install-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div
            className="pwa-install-modal__backdrop"
            onClick={() => setShowIosInstructions(false)}
            aria-hidden="true"
          />

          <div className="pwa-install-modal__content">
            <button
              className="pwa-install-modal__close"
              type="button"
              onClick={() => setShowIosInstructions(false)}
              aria-label="Chiudi istruzioni"
            >
              ×
            </button>

            <span
              className="pwa-install-modal__icon"
              aria-hidden="true"
            >
              📲
            </span>

            <h2 id="pwa-install-title">
              Installa Office Clocking
            </h2>

            <p>
              Su iPhone e iPad l&apos;installazione si esegue dal menu
              Condividi di Safari.
            </p>

            <ol>
              <li>
                Tocca il pulsante <strong>Condividi</strong>.
              </li>
              <li>
                Seleziona <strong>Aggiungi alla schermata Home</strong>.
              </li>
              <li>
                Conferma toccando <strong>Aggiungi</strong>.
              </li>
            </ol>

            <button
              className="pwa-install-modal__confirm"
              type="button"
              onClick={() => setShowIosInstructions(false)}
            >
              Ho capito
            </button>
          </div>
        </div>
      )}
    </>
  );
}
