"use strict";

const express = require("express");
const { TOKEN_MAX_BYTES } = require("../validation/validators");

// Character endpoints. All require a session and an initialized schema. The
// token upload sends the raw image bytes as the request body (no multipart
// dependency); the body parser is scoped to that single route.
function createCharacterRouter({ characterController, schemaMiddleware, requireSession }) {
  const router = express.Router();

  router.use(requireSession, schemaMiddleware);

  router.get("/", characterController.get);
  router.put("/", characterController.save);
  router.get("/token", characterController.getToken);
  router.put(
    "/token",
    express.raw({ type: "image/*", limit: TOKEN_MAX_BYTES }),
    characterController.uploadToken,
  );

  return router;
}

module.exports = { createCharacterRouter };
