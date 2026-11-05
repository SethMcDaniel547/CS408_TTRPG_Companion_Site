"use strict";

const { AppError } = require("../errors/AppError");

// Single global error middleware (architecture guide, backend rule 6). It maps
// typed domain errors to HTTP responses. Controllers forward errors via
// next(error); there is no ad-hoc res.status(500) scattered through handlers.
function errorHandler(logger = console) {
  // Express identifies error middleware by its four-argument signature.
  return function (err, req, res, _next) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }

    // Body-parser failures (malformed JSON, payload too large) carry their own
    // HTTP status and are client errors, not service outages.
    if (err.type === "entity.parse.failed") {
      res.status(400).json({ error: "Request body must be valid JSON" });
      return;
    }
    if (err.type === "entity.too.large") {
      res.status(400).json({ error: "Request body is too large" });
      return;
    }

    // Unexpected errors: log server-side, return a generic message. The route
    // group that produced the error sets res.locals.serviceErrorMessage so the
    // client sees a message appropriate to that service.
    logger.error("Unhandled request error:", err.message);
    const message =
      res.locals.serviceErrorMessage ||
      "The service is temporarily unavailable.";
    res.status(503).json({ error: message });
  };
}

module.exports = { errorHandler };
