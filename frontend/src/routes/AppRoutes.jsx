import {
  BrowserRouter,
  Route,
  Routes,
  Navigate,
  useLocation,
} from "react-router-dom";
import App from "../App";
import Home_user from "../components/Home-user/Home-user";
import Home_admin from "../components/Home-admin/Home-admin";
import Storico from "../components/Storico/Storico";
import { useAuth } from "../context/auth-context";
import { AuthProvider } from "../context/AuthContext";
import FeaturesPage from "../components/FeaturesPage/FeaturesPage";

/**
 * Loader minimale mentre AuthContext controlla
 * se esiste già un utente salvato nel localStorage.
 */
function AuthLoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f3f4f6",
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          padding: "1rem 1.25rem",
          borderRadius: "0.75rem",
          boxShadow: "0 8px 20px rgba(0, 0, 0, 0.08)",
          fontWeight: 600,
          color: "#374151",
        }}
      >
        Caricamento autenticazione...
      </div>
    </div>
  );
}

/**
 * Restituisce la home corretta in base al ruolo utente.
 * Default prudenziale: /login se il ruolo non è valido.
 */
function getHomeByRole(user) {
  const role = String(user?.role || "").toLowerCase();

  if (role === "admin") return "/home-admin";
  if (role === "user") return "/home-user";

  return "/login";
}

/**
 * Route protetta:
 * - se sto ancora caricando auth => loader
 * - se non c'è utente => login
 * - se il ruolo non è ammesso => redirect alla home corretta
 */
function ProtectedRoute({ children, roles }) {
  const { user, authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const userRole = String(user.role || "").toLowerCase();

  if (roles && !roles.includes(userRole)) {
    return <Navigate to={getHomeByRole(user)} replace />;
  }

  return children;
}

/**
 * Route pubblica per la login:
 * se l'utente è già autenticato, lo mando subito
 * nella home corretta invece di mostrargli il form login.
 */
function PublicLoginRoute() {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return <AuthLoadingScreen />;
  }

  if (user) {
    return <Navigate to={getHomeByRole(user)} replace />;
  }

  return <App />;
}

/**
 * Fallback globale:
 * - se sto caricando auth => loader
 * - se utente loggato => home corretta
 * - altrimenti => login
 */
function FallbackRoute() {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return <AuthLoadingScreen />;
  }

  if (user) {
    return <Navigate to={getHomeByRole(user)} replace />;
  }

  return <Navigate to="/login" replace />;
}

export default function AppRouter() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Root */}
          <Route path="/" element={<FallbackRoute />} />

          {/* Login pubblica */}
          <Route path="/login" element={<PublicLoginRoute />} />
          <Route path="/funzionalita" element={<FeaturesPage />} />

          {/* Home user */}
          <Route
            path="/home-user"
            element={
              <ProtectedRoute roles={["user"]}>
                <Home_user />
              </ProtectedRoute>
            }
          />

          {/* Storico user */}
          <Route
            path="/storico"
            element={
              <ProtectedRoute roles={["user"]}>
                <Storico />
              </ProtectedRoute>
            }
          />

          {/* Home admin */}
          <Route
            path="/home-admin"
            element={
              <ProtectedRoute roles={["admin"]}>
                <Home_admin />
              </ProtectedRoute>
            }
          />

          {/* Qualsiasi route sconosciuta */}
          <Route path="*" element={<FallbackRoute />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
