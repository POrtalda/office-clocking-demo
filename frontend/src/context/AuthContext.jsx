import { useCallback, useEffect, useState } from "react";
import {storeSession,clearSession,restoreSession} from "../utils/authSession";
import {quickLoginBody,validateQuickSession} from "../utils/showcaseLogin";
import { AuthContext } from "./auth-context";
import AccountThemeProvider from "../components/Theme/AccountThemeProvider";

export function AuthProvider({ children }) {
  // Utente autenticato corrente
  const [user, setUser] = useState(null);

  // Stato di loading iniziale mentre verifico la sessione salvata
  const [authLoading, setAuthLoading] = useState(true);

  // Messaggio da mostrare nella pagina login
  // Esempi:
  // - logout eseguito
  // - sessione scaduta
  const [sessionMessage, setSessionMessage] = useState("");

  // URL base backend letto da Vite
  const BASE_URL = import.meta.env.VITE_API_URL;

  // =========================
  // LOGIN
  // =========================

  /**
   * Esegue il login contro il backend.
   *
   * Restituisce sempre un oggetto uniforme:
   * {
   *   success: boolean,
   *   message?: string,
   *   retryAfterSeconds?: number,
   *   status?: number,
   *   role?: string
   * }
   */
  function login(username,password){return authenticate("/api/auth/login",{username,password});}
  function loginShowcase(profile){
    if(import.meta.env.VITE_SHOWCASE_REMOTE!=="true")return Promise.resolve({success:false,message:"Accesso non disponibile."});
    return authenticate("/api/demo/showcase/session",quickLoginBody(profile),profile);
  }
  async function authenticate(endpoint,body,expectedProfile) {
    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      /**
       * Provo a leggere il JSON in modo sicuro.
       * Così evito crash se il server restituisce body vuoto
       * o una risposta non perfettamente formata.
       */
      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      // =========================
      // CASO ERRORE LOGIN
      // =========================
      if (!res.ok) {
        /**
         * Recupero il countdown residuo in modo robusto:
         * 1. body.retryAfterSeconds
         * 2. body.retryAfterSec
         * 3. header Retry-After
         * 4. fallback 600 se status 429
         */
        const retryAfterFromBody =
          Number(data.retryAfterSeconds || data.retryAfterSec || 0) || 0;

        const retryAfterFromHeader =
          Number(res.headers.get("Retry-After") || 0) || 0;

        const retryAfterSeconds =
          retryAfterFromBody ||
          retryAfterFromHeader ||
          (res.status === 429 ? 600 : 0);

        /**
         * Messaggio errore robusto:
         * provo prima data.message,
         * poi data.error,
         * poi un fallback leggibile.
         */
        const errorMessage =
          data.message ||
          data.error ||
          (res.status === 401
            ? "Username o password non validi"
            : res.status === 429
            ? "Troppi tentativi. Riprova più tardi."
            : "Errore di login");

        return {
          success: false,
          message: errorMessage,
          retryAfterSeconds,
          status: res.status,
        };
      }

      // =========================
      // CASO LOGIN OK
      // =========================

      // Salvo token e utente nel localStorage
      if(expectedProfile&&!validateQuickSession(data,expectedProfile))throw new Error("Sessione demo non valida");
      storeSession(localStorage,data.token,data.user);

      // Aggiorno stato globale utente
      setUser(data.user);

      // Pulisco eventuali messaggi vecchi
      setSessionMessage("");

      return {
        success: true,
        role: data.user.role,
      };
    } catch (error) {
      console.error("Errore login:", error);

      return {
        success: false,
        message: "Errore di connessione al server",
        retryAfterSeconds: 0,
        status: 0,
      };
    }
  }

  // =========================
  // LOGOUT
  // =========================

  /**
   * Effettua logout locale:
   * - rimuove token
   * - rimuove utente salvato
   * - azzera stato user
   * - può impostare un messaggio da mostrare in login
   */
  const logout = useCallback((message = "") => {
    clearSession(localStorage);

    setUser(null);
    setSessionMessage(message);
  }, []);

  // =========================
  // SESSIONE SCADUTA
  // =========================

  /**
   * Helper centralizzato per gestire token scaduto o non valido.
   */
  const handleSessionExpired = useCallback(() => {
    logout("Sessione scaduta, effettua di nuovo l’accesso.");
  }, [logout]);

  // =========================
  // CONTROLLO AUTH INIZIALE
  // =========================

  useEffect(() => {
    async function checkAuth() {
      const result=await restoreSession(BASE_URL,localStorage);
      if(!result.stale){if(result.expired)handleSessionExpired();else setUser(result.user);}
      setAuthLoading(false);
    }

    checkAuth();
  }, [BASE_URL, handleSessionExpired]);

  return (
    <AuthContext.Provider
      value={{
        user,
        authLoading,
        login,
        loginShowcase,
        logout,
        sessionMessage,
        setSessionMessage,
        handleSessionExpired,
      }}
    >
      <AccountThemeProvider user={user} authLoading={authLoading}>{children}</AccountThemeProvider>
    </AuthContext.Provider>
  );
}
