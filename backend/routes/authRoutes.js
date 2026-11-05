"use strict";

const express = require("express");

// Routes wire URLs, middleware, and handlers. No business logic (architecture
// guide, backend rule 1). Collaborators are injected, not constructed here.
function createAuthRouter({ authController, schemaMiddleware, attachSession }) {
  const router = express.Router();

  router.post("/signup", schemaMiddleware, authController.signup);
  router.post("/signin", schemaMiddleware, authController.signin);
  router.get("/me", attachSession, authController.me);
  router.post("/signout", attachSession, authController.signout);

  return router;
}

module.exports = { createAuthRouter };
