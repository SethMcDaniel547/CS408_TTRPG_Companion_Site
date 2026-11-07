"use strict";

const express = require("express");

// Routes wire URLs, middleware, and handlers. Every room endpoint requires a
// session and an initialized schema; both are applied as middleware here so the
// controller stays a pure HTTP adapter (architecture guide, backend rule 1).
function createRoomRouter({ roomController, schemaMiddleware, requireSession }) {
  const router = express.Router();

  router.use(requireSession, schemaMiddleware);

  router.get("/", roomController.list);
  router.post("/", roomController.create);
  router.post("/join", roomController.join);
  router.get("/:roomId/members", roomController.listMembers);
  router.get("/:roomId/roster", roomController.roster);
  router.get("/:roomId/members/:memberId/character", roomController.memberCharacter);
  router.put("/:roomId/character", roomController.selectCharacter);
  router.post("/:roomId/members", roomController.addMember);
  router.delete("/:roomId/members/:memberId", roomController.removeMember);
  router.delete("/:roomId", roomController.remove);

  return router;
}

module.exports = { createRoomRouter };
