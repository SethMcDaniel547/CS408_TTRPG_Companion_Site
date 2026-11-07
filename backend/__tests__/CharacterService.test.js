"use strict";

const { CharacterService } = require("../services/CharacterService");

function makeService(overrides = {}) {
  const characterRepo = {
    findByAccount: jest.fn().mockResolvedValue(null),
    upsert: jest.fn(),
    setToken: jest.fn(),
    getToken: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
  const accountRepo = { findIdByUsername: jest.fn() };
  return { service: new CharacterService(characterRepo, accountRepo), characterRepo, accountRepo };
}

describe("CharacterService", () => {
  it("returns an empty character when none is saved", async () => {
    const { service } = makeService();
    expect(await service.getCharacter(1)).toEqual({ name: "", info: "", hasToken: false, tokenUrl: null });
  });

  it("saves name and info and returns the view", async () => {
    const row = { name: "Nyx", info: "bio", has_token: false, updated_at: new Date(0) };
    const { service, characterRepo } = makeService({ upsert: jest.fn().mockResolvedValue(row) });
    const result = await service.saveCharacter(4, { name: "Nyx", info: "bio" });
    expect(characterRepo.upsert).toHaveBeenCalledWith({ accountId: 4, name: "Nyx", info: "bio" });
    expect(result).toEqual({ name: "Nyx", info: "bio", hasToken: false, tokenUrl: null });
  });

  it("exposes a token URL once a token is stored", async () => {
    const row = { name: "Nyx", info: "", has_token: true, updated_at: new Date(5) };
    const { service } = makeService({ setToken: jest.fn().mockResolvedValue(row) });
    const result = await service.saveToken(1, { data: Buffer.from("x"), contentType: "image/png" });
    expect(result.tokenUrl).toBe("/api/character/token?v=5");
  });

  it("throws 404 when no token exists", async () => {
    const { service } = makeService();
    await expect(service.getToken(1)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 401 when the session account is gone", async () => {
    const { service, accountRepo } = makeService();
    accountRepo.findIdByUsername.mockResolvedValue(null);
    await expect(service.requireAccountId("ghost")).rejects.toMatchObject({ statusCode: 401 });
  });
});
