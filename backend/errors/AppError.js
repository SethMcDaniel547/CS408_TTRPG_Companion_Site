"use strict";

// Typed domain error (architecture guide, backend rule 6). Services throw these;
// a single global error middleware maps statusCode to an HTTP response.
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}

module.exports = { AppError };
