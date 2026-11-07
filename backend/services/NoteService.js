"use strict";

const { AppError } = require("../errors/AppError");

const MAX_NOTES_PER_ACCOUNT = 500;

// Business rules for per-character notes. Ownership is always checked against
// the signed-in account.
class NoteService {
  constructor(noteRepo, characterRepo, accountRepo) {
    this.noteRepo = noteRepo;
    this.characterRepo = characterRepo;
    this.accountRepo = accountRepo;
  }

  async requireAccountId(username) {
    const accountId = await this.accountRepo.findIdByUsername(username);
    if (!accountId) {
      throw new AppError("Your account could not be found.", 401);
    }
    return accountId;
  }

  static view(row) {
    return {
      id: row.id,
      characterId: row.character_id,
      title: row.title,
      body: row.body,
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  async list(accountId) {
    const rows = await this.noteRepo.listForAccount(accountId);
    return rows.map(NoteService.view);
  }

  async create(accountId, { characterId, title, body }) {
    if (!(await this.characterRepo.findOwned(characterId, accountId))) {
      throw new AppError("Character not found.", 404);
    }
    if ((await this.noteRepo.listForAccount(accountId)).length >= MAX_NOTES_PER_ACCOUNT) {
      throw new AppError("You have reached the note limit.", 400);
    }
    const row = await this.noteRepo.create({ characterId, title, body });
    return NoteService.view(row);
  }

  async update(accountId, id, { title, body }) {
    const row = await this.noteRepo.updateOwned({ id, accountId, title, body });
    if (!row) throw new AppError("Note not found.", 404);
    return NoteService.view(row);
  }

  async remove(accountId, id) {
    if (!(await this.noteRepo.deleteOwned(id, accountId))) {
      throw new AppError("Note not found.", 404);
    }
  }
}

module.exports = { NoteService };
