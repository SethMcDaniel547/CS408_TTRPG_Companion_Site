"use strict";

const express = require("express");

function createNoteRouter({ noteController, schemaMiddleware, requireSession }) {
  const router = express.Router();

  router.use(requireSession, schemaMiddleware);

  router.get("/", noteController.list);
  router.post("/", noteController.create);
  router.put("/:noteId", noteController.update);
  router.delete("/:noteId", noteController.remove);

  return router;
}

module.exports = { createNoteRouter };
