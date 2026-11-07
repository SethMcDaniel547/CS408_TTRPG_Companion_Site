"use strict";

const { AppError } = require("../errors/AppError");

const MAX_CHARACTERS_PER_ACCOUNT = 25;

// Business rules for a player's characters. No req/res, no SQL.
class CharacterService {
  constructor(characterRepo, accountRepo) {
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

  static tokenUrl(characterId, updatedAt) {
    return `/api/characters/${characterId}/token?v=${new Date(updatedAt).getTime()}`;
  }

  static view(row) {
    return {
      id: row.id,
      name: row.name,
      info: row.info,
      hasToken: row.has_token,
      tokenUrl: row.has_token ? CharacterService.tokenUrl(row.id, row.updated_at) : null,
    };
  }

  async list(accountId) {
    const rows = await this.characterRepo.listByAccount(accountId);
    return rows.map(CharacterService.view);
  }

  async create(accountId, { name, info }) {
    if ((await this.characterRepo.countByAccount(accountId)) >= MAX_CHARACTERS_PER_ACCOUNT) {
      throw new AppError(`You can have at most ${MAX_CHARACTERS_PER_ACCOUNT} characters.`, 400);
    }
    const row = await this.characterRepo.create({ accountId, name, info });
    return CharacterService.view(row);
  }

  async update(accountId, id, { name, info }) {
    const row = await this.characterRepo.update({ id, accountId, name, info });
    if (!row) throw new AppError("Character not found.", 404);
    return CharacterService.view(row);
  }

  async remove(accountId, id) {
    if (!(await this.characterRepo.deleteOwned(id, accountId))) {
      throw new AppError("Character not found.", 404);
    }
  }

  async saveToken(accountId, id, { data, contentType }) {
    const row = await this.characterRepo.setToken({ id, accountId, data, contentType });
    if (!row) throw new AppError("Character not found.", 404);
    return CharacterService.view(row);
  }

  async getToken(viewerId, id) {
    const token = await this.characterRepo.getTokenForViewer(id, viewerId);
    if (!token) throw new AppError("No token available.", 404);
    return token;
  }
}

module.exports = { CharacterService };
