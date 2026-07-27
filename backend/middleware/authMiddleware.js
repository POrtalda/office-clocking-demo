/**
 * middleware/authMiddleware.js
 *
 * Middleware di autenticazione JWT.
 *
 * Responsabilità:
 * - leggere l'header Authorization
 * - verificare presenza e formato del token Bearer
 * - validare il JWT
 * - salvare i dati utente decodificati in req.user
 * - inoltrare gli errori al middleware globale
 */

const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");

/**
 * Middleware che protegge le route riservate agli utenti autenticati.
 *
 * Header atteso:
 * Authorization: Bearer <token>
 *
 * Se il token è valido, salva in req.user i dati essenziali:
 * - id
 * - username
 * - role
 */
function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    // Header Authorization assente
    if (!authHeader) {
      return next(new AppError("Token mancante", 401, "MISSING_TOKEN"));
    }

    // Deve essere nel formato: Bearer <token>
    if (!authHeader.startsWith("Bearer ")) {
      return next(
        new AppError("Formato token non valido", 401, "INVALID_TOKEN_FORMAT")
      );
    }

    // Estrae il token dalla stringa "Bearer xxx"
    const token = authHeader.slice(7).trim();

    // Token vuoto o assente dopo "Bearer "
    if (!token) {
      return next(new AppError("Token mancante", 401, "MISSING_TOKEN"));
    }

    // Verifica firma e validità del JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Salva solo i dati utili per le route successive
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
    };

    return next();
  } catch (err) {
    // Token scaduto
    if (err.name === "TokenExpiredError") {
      return next(new AppError("Sessione scaduta", 401, "TOKEN_EXPIRED"));
    }

    // Token malformato, firma non valida, ecc.
    if (err.name === "JsonWebTokenError") {
      return next(new AppError("Token non valido", 401, "INVALID_TOKEN"));
    }

    // Altri errori inattesi
    return next(err);
  }
}

module.exports = { authMiddleware };