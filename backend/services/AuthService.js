"use strict";

const { AppError } = require("../errors/AppError");

// Business rules for authentication. No req/res, no raw SQL, no driver imports.
// Collaborators (repository, crypto, session store) are injected via the
// constructor (architecture guide, backend rules 1 & 2).
class AuthService {
  constructor(accountRepo, crypto, sessionStore) {
    this.accountRepo = accountRepo;
    this.crypto = crypto;
    this.sessionStore = sessionStore;
  }

  // Registers a new account and returns a fresh session token.
  async signup({ username, password, email }) {
    const passwordHash = await this.crypto.hash(password, 12);
    try {
      await this.accountRepo.create({ username, passwordHash, email });
    } catch (error) {
      if (error.code === "23505") {
        throw new AppError("That username is already in use.", 409);
      }
      throw error;
    }
    return { username, token: this.sessionStore.create(username) };
  }

  // Verifies credentials and returns a fresh session token.
  async signin({ username, password }) {
    const account = await this.accountRepo.findByUsername(username);
    const valid =
      account && (await this.crypto.compare(password, account.password_hash));
    if (!valid) {
      throw new AppError("Invalid username or password.", 401);
    }
    return { username, token: this.sessionStore.create(username) };
  }

  session(token) {
    return this.sessionStore.get(token);
  }

  signout(token) {
    this.sessionStore.destroy(token);
  }
}

module.exports = { AuthService };
