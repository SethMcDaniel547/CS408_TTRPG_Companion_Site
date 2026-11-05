"use strict";

const { parseCookies } = require("./cookies");
const { AppError } = require("../errors/AppError");

// Middleware factory: wires auth onto requests. No business logic lives here —
// it only reads the session cookie, consults the injected AuthService, and
// attaches the resolved session to req (architecture guide, backend rule 1).
function createAuthMiddleware(authService, sessionCookieName) {
  // Attaches req.session (or null) without rejecting. Used for endpoints that
  // behave differently for guests vs. members.
  function attachSession(req, _res, next) {
    const token = parseCookies(req)[sessionCookieName];
    req.session = authService.session(token);
    next();
  }

  // Rejects unauthenticated requests before they reach a controller.
  function requireSession(req, _res, next) {
    const token = parseCookies(req)[sessionCookieName];
    const session = authService.session(token);
    if (!session) {
      next(new AppError("You must be signed in.", 401));
      return;
    }
    req.session = session;
    next();
  }

  return { attachSession, requireSession };
}

// Ensures the database schema exists before a route group runs. Injected with
// the schema initializer so it can be reused across routers.
function createSchemaMiddleware(ensureSchema) {
  return async function (_req, _res, next) {
    try {
      await ensureSchema();
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { createAuthMiddleware, createSchemaMiddleware };
