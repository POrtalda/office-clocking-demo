const AppError = require("../utils/AppError");

function errorHandler(err, req, res, next) {
  let error = err;

  // Errori non previsti trasformati in AppError
  if (!(error instanceof AppError)) {
    error = new AppError(
      error.message || "Errore interno del server",
      error.statusCode || 500,
      error.code || "SERVER_ERROR"
    );
  }

  // Errori mongoose comuni
  if (err.name === "CastError") {
    error = new AppError("Parametro non valido", 400, "INVALID_ID");
  }

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    error = new AppError(
      messages.join(", ") || "Dati non validi",
      400,
      "VALIDATION_ERROR"
    );
  }

  // JWT comuni
  if (err.name === "JsonWebTokenError") {
    error = new AppError("Token non valido", 401, "INVALID_TOKEN");
  }

  if (err.name === "TokenExpiredError") {
    error = new AppError("Token scaduto", 401, "TOKEN_EXPIRED");
  }

  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    message: error.message || "Errore interno del server",
    code: error.code || "SERVER_ERROR",
  });
}

module.exports = errorHandler;
