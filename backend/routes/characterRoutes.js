"use strict";

const express = require("express");
const { TOKEN_MAX_BYTES } = require("../validation/validators");

// Character endpoints. All require a session and an initialized schema. The
// token upload sends the raw image bytes as the request body (no multipart
// dependency); the body parser is scoped to that single route.
function createCharacterRouter({ characterController, schemaMiddleware, requireSession }) {
  const router = express.Router();

  router.use(requireSession, schemaMiddleware);

  router.get("/", characterController.list);
  router.post("/", characterController.create);
  router.put("/:characterId", characterController.update);
  router.delete("/:characterId", characterController.remove);
  router.get("/:characterId/token", characterController.getToken);
  router.put(
    "/:characterId/token",
    express.raw({ type: "image/*", limit: TOKEN_MAX_BYTES }),
    characterController.uploadToken,
  );

  return router;
}

module.exports = { createCharacterRouter };
