"use strict";

const { AppError } = require("../errors/AppError");

// Business rules for a player's character. No req/res, no SQL.
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

  // A player who has not saved anything yet gets an empty character, not a 404.
  static view(row) {
    if (!row) {
      return { name: "", info: "", hasToken: false, tokenUrl: null };
    }
    const version = new Date(row.updated_at).getTime();
    return {
      name: row.name,
      info: row.info,
      hasToken: row.has_token,
      tokenUrl: row.has_token ? `/api/character/token?v=${version}` : null,
    };
  }

  async getCharacter(accountId) {
    return CharacterService.view(await this.characterRepo.findByAccount(accountId));
  }

  async saveCharacter(accountId, { name, info }) {
    const row = await this.characterRepo.upsert({ accountId, name, info });
    return CharacterService.view(row);
  }

  async saveToken(accountId, { data, contentType }) {
    const row = await this.characterRepo.setToken({ accountId, data, contentType });
    return CharacterService.view(row);
  }

  async getToken(accountId) {
    const token = await this.characterRepo.getToken(accountId);
    if (!token) {
      throw new AppError("No token has been uploaded.", 404);
    }
    return token;
  }
}

module.exports = { CharacterService };
