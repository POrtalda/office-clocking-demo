import {
  useState,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "./context/auth-context";
import "./App.css";

function App() {
  // Dati e funzioni condivise dal context autenticazione
  const { login, user, sessionMessage, setSessionMessage } =
    useContext(AuthContext);

  // Hook React Router per navigare tra le pagine
  const navigate = useNavigate();

  // =========================
  // STATI FORM
  // =========================

  // Campi del login
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Messaggio di errore login
  const [error, setError] = useState("");

  // Countdown blocco login per username
  const [retryAfterSec, setRetryAfterSec] = useState(0);

  // Evita doppi submit mentre la richiesta è in corso
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [demoAccounts, setDemoAccounts] = useState([]);
  const [demoAccountsLoading, setDemoAccountsLoading] = useState(false);
  const [demoAccountsError, setDemoAccountsError] = useState("");

  const loginFormRef = useRef(null);

  // =========================
  // CONFIGURAZIONE DEMO
  // =========================

  // Attiva il box helper solo negli ambienti demo
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

  // =========================
  // VALORI DERIVATI
  // =========================

  // Username normalizzato per confronti e localStorage
  const normalizedUsername = useMemo(() => {
    return username.trim().toLowerCase();
  }, [username]);

  // True se esiste un blocco login attivo
  const isBlocked = retryAfterSec > 0;

  // Disabilita il submit quando il form non è utilizzabile
  const isFormDisabled =
    isSubmitting || isBlocked || !username.trim() || !password.trim();

  // =========================
  // HELPERS
  // =========================

  /**
   * Chiave localStorage specifica per username.
   * Così ogni utente ha il suo blocco separato.
   */
  const getBlockedKey = useCallback((name) => {
    const safeName =
      String(name || "").trim().toLowerCase() || "no-username";

    return `loginBlockedUntil:${safeName}`;
  }, []);

  /**
   * Compila automaticamente username e password di un account demo.
   * Non esegue il login automatico:
   * l'utente deve comunque cliccare "Accedi".
   */
  function fillDemoCredentials(account) {
    setUsername(account.username);
    setPassword(account.password);
    setError("");
    setSessionMessage("");

    requestAnimationFrame(() => {
      loginFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function getDemoAccountLabel(account) {
    const fullName = [account.name, account.surname]
      .filter(Boolean)
      .join(" ");

    if (fullName) return fullName;

    return account.username;
  }

  function getDemoAccountDescription(account) {
    return account.role === "admin"
      ? "Dashboard aziendale"
      : "Dashboard utente";
  }

  function getDemoAccountIcon(account) {
    return account.role === "admin" ? "👑" : "👤";
  }

  /**
   * Converte secondi in formato mm:ss
   * Esempio: 125 -> 02:05
   */
  function formatCountdown(totalSec) {
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
      2,
      "0"
    )}`;
  }

  /**
   * Restituisce i secondi rimanenti di blocco per lo username corrente.
   * Se il blocco è scaduto o invalido, lo rimuove.
   */
  const getRemainingBlockSeconds = useCallback(
    (name) => {
      const storageKey = getBlockedKey(name);
      const savedUntil = localStorage.getItem(storageKey);

      if (!savedUntil) return 0;

      const blockedUntilMs = Number(savedUntil);
      const now = Date.now();

      if (Number.isNaN(blockedUntilMs) || blockedUntilMs <= now) {
        localStorage.removeItem(storageKey);
        return 0;
      }

      return Math.ceil((blockedUntilMs - now) / 1000);
    },
    [getBlockedKey]
  );

  // =========================
  // CARICAMENTO ACCOUNT DEMO
  // =========================

  useEffect(() => {
    if (!isDemoMode) return;

    let isMounted = true;

    async function loadDemoAccounts() {
      setDemoAccountsLoading(true);
      setDemoAccountsError("");

      try {
        const baseUrl = import.meta.env.VITE_API_URL;

        const response = await fetch(`${baseUrl}/api/demo/login-users`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data?.message || "Impossibile caricare gli utenti demo."
          );
        }

        const users = Array.isArray(data?.users) ? data.users : [];

        if (!isMounted) return;

        const sortedUsers = [...users].sort((firstUser, secondUser) => {
          if (firstUser.role === "admin" && secondUser.role !== "admin") {
            return -1;
          }

          if (firstUser.role !== "admin" && secondUser.role === "admin") {
            return 1;
          }

          const firstLabel =
            getDemoAccountLabel(firstUser).toLowerCase();

          const secondLabel =
            getDemoAccountLabel(secondUser).toLowerCase();

          return firstLabel.localeCompare(secondLabel, "it");
        });

        setDemoAccounts(
          sortedUsers.map((demoUser) => ({
            ...demoUser,
            label: getDemoAccountLabel(demoUser),
            password: "1234",
            icon: getDemoAccountIcon(demoUser),
            description: getDemoAccountDescription(demoUser),
            featured: demoUser.role === "admin",
            roleLabel: demoUser.role === "admin" ? "Admin" : "Utente",
          }))
        );
      } catch (error) {
        if (!isMounted) return;

        setDemoAccounts([]);

        setDemoAccountsError(
          error.message || "Impossibile caricare gli utenti demo."
        );
      } finally {
        if (isMounted) {
          setDemoAccountsLoading(false);
        }
      }
    }

    loadDemoAccounts();

    return () => {
      isMounted = false;
    };
  }, [isDemoMode]);

  // =========================
  // REDIRECT SE GIÀ LOGGATO
  // =========================

  useEffect(() => {
    if (!user) return;

    const role = String(user.role || "").toLowerCase();

    if (role === "admin") {
      navigate("/home-admin", { replace: true });
      return;
    }

    navigate("/home-user", { replace: true });
  }, [user, navigate]);

  // =========================
  // RECUPERO BLOCCO DA LOCALSTORAGE
  // =========================

  useEffect(() => {
    const remainingSec =
      getRemainingBlockSeconds(normalizedUsername);

    setRetryAfterSec(remainingSec);
  }, [getRemainingBlockSeconds, normalizedUsername]);

  // =========================
  // COUNTDOWN LIVE
  // =========================

  useEffect(() => {
    if (!normalizedUsername || retryAfterSec <= 0) return;

    const timer = setInterval(() => {
      const remainingSec =
        getRemainingBlockSeconds(normalizedUsername);

      setRetryAfterSec(remainingSec);
    }, 1000);

    return () => clearInterval(timer);
  }, [
    getRemainingBlockSeconds,
    retryAfterSec,
    normalizedUsername,
  ]);

  // =========================
  // PULIZIA MESSAGGI SOLO QUANDO L'UTENTE CAMBIA INPUT
  // =========================

  useEffect(() => {
    setError("");
    setSessionMessage("");
  }, [username, password, setSessionMessage]);

  // =========================
  // SUBMIT LOGIN
  // =========================

  async function handleSubmit(e) {
    e.preventDefault();

    if (isSubmitting || isBlocked) return;

    setError("");
    setSessionMessage("");
    setIsSubmitting(true);

    try {
      const result = await login(username, password);

      if (!result.success) {
        setError(
          result.message || "Username o password non validi."
        );

        let retrySeconds =
          Number(result.retryAfterSeconds || 0);

        // Fallback prudenziale se arriva 429 ma senza countdown
        if (result.status === 429 && retrySeconds <= 0) {
          retrySeconds = 600;
        }

        if (retrySeconds > 0) {
          const blockedUntil =
            Date.now() + retrySeconds * 1000;

          localStorage.setItem(
            getBlockedKey(normalizedUsername),
            String(blockedUntil)
          );

          setRetryAfterSec(retrySeconds);
          setPassword("");
        }

        return;
      }

      // Login ok: pulizia blocco locale
      localStorage.removeItem(
        getBlockedKey(normalizedUsername)
      );

      setRetryAfterSec(0);
      setError("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <h1 className="login-title">Office Clocking</h1>

            <p className="login-subtitle">
              Accedi per gestire timbrature e presenze
            </p>
          </div>

          {sessionMessage && (
            <div className="login-message login-message-warning">
              {sessionMessage}
            </div>
          )}

          {error && (
            <div className="login-message login-message-error">
              {error}
            </div>
          )}

          {isBlocked && (
            <div className="login-message login-message-info">
              L&apos;utente{" "}
              <strong>
                {normalizedUsername || "selezionato"}
              </strong>{" "}
              è temporaneamente bloccato. Riprova tra{" "}
              <strong>
                {formatCountdown(retryAfterSec)}
              </strong>
              .
            </div>
          )}

          {isDemoMode && (
            <div className="login-demo-helper">
              <div className="login-demo-kicker">
                Versione dimostrativa
              </div>

              <p className="login-demo-note">
                Questa demo usa dati dimostrativi. Alcune
                azioni sensibili sono disabilitate.
              </p>

              <h2>🚀 Prova Office Clocking</h2>

              <p>
                Scegli il profilo che vuoi provare.
                Username e password verranno compilati
                automaticamente.
              </p>

              <div className="login-demo-buttons">
                {demoAccountsLoading ? (
                  <p className="login-demo-status">
                    Carico utenti demo...
                  </p>
                ) : demoAccountsError ? (
                  <p className="login-demo-status login-demo-status-error">
                    {demoAccountsError}
                  </p>
                ) : demoAccounts.length === 0 ? (
                  <p className="login-demo-status">
                    Nessun utente demo disponibile.
                  </p>
                ) : (
                  demoAccounts.map((account) => (
                    <button
                      key={account.username}
                      type="button"
                      className={`login-demo-button${
                        account.featured
                          ? " login-demo-button-featured"
                          : ""
                      }`}
                      onClick={() =>
                        fillDemoCredentials(account)
                      }
                      disabled={isSubmitting}
                    >
                      <span className="login-demo-button-icon">
                        {account.icon}
                      </span>

                      <span className="login-demo-button-text">
                        <span className="login-demo-button-heading">
                          <strong>
                            {account.label}
                          </strong>

                          <span
                            className={`login-demo-role-badge${
                              account.featured
                                ? " login-demo-role-badge-featured"
                                : ""
                            }`}
                          >
                            {account.roleLabel}
                          </span>
                        </span>

                        <small>
                          {account.description}
                        </small>

                        {account.featured && (
                          <span className="login-demo-recommended">
                            Consigliato per iniziare
                          </span>
                        )}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          <form
            ref={loginFormRef}
            className="login-form"
            onSubmit={handleSubmit}
          >
            <div className="login-field">
              <label htmlFor="username">
                Username
              </label>

              <input
                id="username"
                className="login-input"
                type="text"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value)
                }
                placeholder="Inserisci username"
                autoComplete="username"
                disabled={isSubmitting}
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">
                Password
              </label>

              <input
                id="password"
                className="login-input"
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="Inserisci password"
                autoComplete="current-password"
                disabled={
                  isSubmitting || isBlocked
                }
              />
            </div>

            <button
              className="login-button"
              type="submit"
              disabled={isFormDisabled}
            >
              {isBlocked
                ? `Attendi ${formatCountdown(
                    retryAfterSec
                  )}`
                : isSubmitting
                  ? "Accesso in corso..."
                  : "Accedi"}
            </button>
          </form>

          {isDemoMode && (
            <div className="login-features-cta">
              <span>
                Vuoi prima capire cosa include la demo?
              </span>

              <Link
                className="login-features-link"
                to="/funzionalita"
              >
                Scopri tutte le funzionalità
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default App;
