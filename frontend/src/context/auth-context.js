import { createContext, useContext } from "react";

// Context globale dell'autenticazione.
// Conterrà user, login, logout e authLoading.
export const AuthContext = createContext(null);

// Hook personalizzato per usare più facilmente il context
// invece di scrivere ogni volta useContext(AuthContext).
export const useAuth = () => useContext(AuthContext);