/**
 * controllers/authController.js
 *
 * Contiene la logica delle rotte di autenticazione.
 *
 * Funzioni esportate:
 * - loginUser -> gestisce il login e genera il JWT
 * - getMe     -> restituisce i dati minimi dell'utente autenticato
 *
 * Obiettivi di questa versione:
 * - usare il middleware globale degli errori
 * - evitare risposte errore sparse nei controller
 * - rendere uniforme il formato degli errori
 * - bloccare il login degli utenti disattivati
 */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AppError = require("../utils/AppError");

/**
 * POST /api/auth/login
 *
 * Body atteso:
 * {
 *   "username": "mario",
 *   "password": "1234"
 * }
 *
 * Flusso:
 * 1. valida presenza username e password
 * 2. normalizza lo username
 * 3. cerca l'utente nel database
 * 4. blocca il login se l'utente è disattivato
 * 5. confronta la password con l'hash salvato
 * 6. genera un JWT con scadenza 8h
 * 7. restituisce token + dati minimi utente
 */
async function loginUser(req, res, next) {
  try {
    // Recupero dei valori dal body
    const rawUsername = req.body?.username;
    const rawPassword = req.body?.password;

    // Validazione minima: entrambi i campi sono obbligatori
    if (!rawUsername || !rawPassword) {
      return next(
        new AppError(
          "Username e password sono obbligatori",
          400,
          "MISSING_CREDENTIALS"
        )
      );
    }

    // Normalizzazione dello username:
    // - trim: rimuove spazi accidentali
    // - lowercase: rende il confronto coerente nel DB
    const normalizedUsername = String(rawUsername).trim().toLowerCase();

    // La password non viene trim-mata:
    // eventuali spazi fanno parte del valore inserito dall'utente
    const password = String(rawPassword);

    // Se lo username normalizzato è vuoto, la richiesta è invalida
    if (!normalizedUsername) {
      return next(
        new AppError(
          "Username e password sono obbligatori",
          400,
          "MISSING_CREDENTIALS"
        )
      );
    }

    // Cerco l'utente nel database tramite username normalizzato
    const user = await User.findOne({ username: normalizedUsername });

    // Messaggio generico per non rivelare se lo username esiste o meno
    if (!user) {
      return next(
        new AppError(
          "Credenziali non valide",
          401,
          "INVALID_CREDENTIALS"
        )
      );
    }

    // Blocco login per utenti disattivati
    if (user.isActive === false) {
      return next(
        new AppError(
          "Utente disattivato. Contatta l'amministratore",
          403,
          "USER_DISABLED"
        )
      );
    }

    // Confronto password in chiaro con hash salvato nel DB
    const isMatch = await bcrypt.compare(password, user.password);

    // Password errata
    if (!isMatch) {
      return next(
        new AppError(
          "Credenziali non valide",
          401,
          "INVALID_CREDENTIALS"
        )
      );
    }

    // Verifica configurazione JWT
    if (!process.env.JWT_SECRET) {
      return next(
        new AppError(
          "Configurazione server incompleta",
          500,
          "MISSING_JWT_SECRET"
        )
      );
    }

    // Generazione del token JWT
    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    // Risposta finale di successo
    return res.status(200).json({
      message: "Login effettuato con successo",
      token,
      user: {
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    // Tutti gli errori passano all'error handler globale
    return next(err);
  }
}

/**
 * GET /api/auth/me
 *
 * Richiede authMiddleware già eseguito.
 *
 * Restituisce:
 * - id
 * - username
 * - role
 *
 * Serve al frontend per verificare se il token è ancora valido
 * e ricostruire la sessione utente.
 */
async function getMe(req, res, next) {
  try {
    // Difesa extra: req.user dovrebbe essere già presente
    if (!req.user) {
      return next(
        new AppError(
          "Utente non autenticato",
          401,
          "UNAUTHENTICATED"
        )
      );
    }

    return res.status(200).json({
      user: {
        id: req.user.id,
        username: req.user.username,
        role: req.user.role,
      },
    });
  } catch (err) {
    // Tutti gli errori passano all'error handler globale
    return next(err);
  }
}

module.exports = {
  loginUser,
  getMe,
};