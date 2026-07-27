const AppError = require("../utils/AppError");

function notFound(req, res, next) {
  next(new AppError(`Route non trovata: ${req.method} ${req.originalUrl}`, 404, "NOT_FOUND"));
}

module.exports = notFound;
