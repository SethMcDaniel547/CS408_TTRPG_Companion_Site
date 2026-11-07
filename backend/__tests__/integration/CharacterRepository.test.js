"use strict";

const { AccountRepository } = require("../../repositories/AccountRepository");
const { CharacterRepository } = require("../../repositories/CharacterRepository");
const { createTestPool, resetTables } = require("./testDatabase");

let pool;
let accounts;
let characters;

beforeAll(() => {
  pool = createTestPool();
  accounts = new AccountRepository(pool);
  characters = new CharacterRepository(pool);
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await resetTables(pool);
});

async function makeAccount(username) {
  await accounts.create({ username, passwordHash: "hash", email: null });
  return accounts.findIdByUsername(username);
}

describe("CharacterRepository (integration)", () => {
  it("returns null when no character exists", async () => {
    const id = await makeAccount("alice");
    expect(await characters.findByAccount(id)).toBeNull();
    expect(await characters.getToken(id)).toBeNull();
  });

  it("upserts name and info", async () => {
    const id = await makeAccount("alice");
    await characters.upsert({ accountId: id, name: "Nyx", info: "one" });
    const row = await characters.upsert({ accountId: id, name: "Nyx2", info: "two" });
    expect(row).toMatchObject({ name: "Nyx2", info: "two", has_token: false });
  });

  it("stores a token without clobbering name, and name save keeps the token", async () => {
    const id = await makeAccount("alice");
    await characters.upsert({ accountId: id, name: "Nyx", info: "" });
    const data = Buffer.from([1, 2, 3, 4]);
    await characters.setToken({ accountId: id, data, contentType: "image/png" });
    await characters.upsert({ accountId: id, name: "Renamed", info: "" });

    const row = await characters.findByAccount(id);
    expect(row).toMatchObject({ name: "Renamed", has_token: true });
    const token = await characters.getToken(id);
    expect(token.contentType).toBe("image/png");
    expect(token.data.equals(data)).toBe(true);
  });

  it("creates a row when a token is uploaded before any name is saved", async () => {
    const id = await makeAccount("alice");
    const row = await characters.setToken({ accountId: id, data: Buffer.from([9]), contentType: "image/gif" });
    expect(row).toMatchObject({ name: "", has_token: true });
  });
});
