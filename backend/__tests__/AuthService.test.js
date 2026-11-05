"use strict";

// Unit tests for AuthService. Collaborators are injected as lightweight stubs
// through the constructor; no module mocking (architecture testing rule 1).
const { AuthService } = require("../services/AuthService");
const { AppError } = require("../errors/AppError");

function makeSessionStore() {
  return { create: jest.fn().mockReturnValue("token-123"), get: jest.fn(), destroy: jest.fn() };
}

describe("AuthService.signup", () => {
  it("hashes the password before persisting and returns a session", async () => {
    const accountRepo = { create: jest.fn().mockResolvedValue(undefined) };
    const crypto = { hash: jest.fn().mockResolvedValue("hashed") };
    const sessionStore = makeSessionStore();
    const service = new AuthService(accountRepo, crypto, sessionStore);

    const result = await service.signup({
      username: "alice",
      password: "supersecret",
      email: null,
    });

    expect(crypto.hash).toHaveBeenCalledWith("supersecret", 12);
    expect(accountRepo.create).toHaveBeenCalledWith({
      username: "alice",
      passwordHash: "hashed",
      email: null,
    });
    expect(result).toEqual({ username: "alice", token: "token-123" });
  });

  it("maps a unique-violation into a 409 AppError (failure path)", async () => {
    const accountRepo = {
      create: jest.fn().mockRejectedValue(Object.assign(new Error("dup"), { code: "23505" })),
    };
    const crypto = { hash: jest.fn().mockResolvedValue("hashed") };
    const service = new AuthService(accountRepo, crypto, makeSessionStore());

    await expect(
      service.signup({ username: "alice", password: "supersecret", email: null }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("AuthService.signin", () => {
  it("returns a session when the password matches", async () => {
    const accountRepo = {
      findByUsername: jest.fn().mockResolvedValue({ username: "bob", password_hash: "stored" }),
    };
    const crypto = { compare: jest.fn().mockResolvedValue(true) };
    const sessionStore = makeSessionStore();
    const service = new AuthService(accountRepo, crypto, sessionStore);

    const result = await service.signin({ username: "bob", password: "pw" });

    expect(crypto.compare).toHaveBeenCalledWith("pw", "stored");
    expect(result).toEqual({ username: "bob", token: "token-123" });
  });

  it("throws 401 when the account is missing (failure path)", async () => {
    const accountRepo = { findByUsername: jest.fn().mockResolvedValue(null) };
    const crypto = { compare: jest.fn() };
    const service = new AuthService(accountRepo, crypto, makeSessionStore());

    await expect(service.signin({ username: "ghost", password: "pw" })).rejects.toBeInstanceOf(AppError);
    expect(crypto.compare).not.toHaveBeenCalled();
  });

  it("throws 401 when the password does not match (failure path)", async () => {
    const accountRepo = {
      findByUsername: jest.fn().mockResolvedValue({ username: "bob", password_hash: "stored" }),
    };
    const crypto = { compare: jest.fn().mockResolvedValue(false) };
    const service = new AuthService(accountRepo, crypto, makeSessionStore());

    await expect(service.signin({ username: "bob", password: "wrong" })).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});
