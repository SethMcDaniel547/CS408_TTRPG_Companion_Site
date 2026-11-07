"use strict";

const { validateNote, validateId } = require("../validation/validators");

// HTTP adapter for notes.
class NoteController {
  constructor(noteService) {
    this.noteService = noteService;
  }

  setServiceErrorMessage(res) {
    res.locals.serviceErrorMessage = "Notes are temporarily unavailable.";
  }

  accountId(req) {
    return this.noteService.requireAccountId(req.session.username);
  }

  list = async (req, res, next) => {
    this.setServiceErrorMessage(res);
    try {
      const notes = await this.noteService.list(await this.accountId(req));
      res.status(200).json({ notes });
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    this.setServiceErrorMessage(res);
    try {
      const accountId = await this.accountId(req);
      const characterId = validateId(req.body.characterId, "character id");
      const input = validateNote(req.body);
      const note = await this.noteService.create(accountId, { characterId, ...input });
      res.status(201).json({ note });
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    this.setServiceErrorMessage(res);
    try {
      const accountId = await this.accountId(req);
      const id = validateId(req.params.noteId, "note id");
      const note = await this.noteService.update(accountId, id, validateNote(req.body));
      res.status(200).json({ note });
    } catch (error) {
      next(error);
    }
  };

  remove = async (req, res, next) => {
    this.setServiceErrorMessage(res);
    try {
      const accountId = await this.accountId(req);
      const id = validateId(req.params.noteId, "note id");
      await this.noteService.remove(accountId, id);
      res.status(200).json({ deleted: true });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { NoteController };
