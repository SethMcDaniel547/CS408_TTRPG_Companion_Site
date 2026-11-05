"use strict";

// Integration tests: AccountRepository against a real Postgres (architecture
// testing rule 2). These catch real SQL/constraint behavior a mock cannot:
// the UNIQUE violation error code, CHAR/VARCHAR handling, and null-on-missing.
const { AccountRepository } = require("../../repositories/AccountRepository");
const { createTestPool, resetTables } = require("./testDatabase");

let pool;
let repo;

beforeAll(() => {
  pool = createTestPool();
  repo = new AccountRepository(pool);
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await resetTables(pool);
});

describe("AccountRepository (integration)", () => {
  it("creates an account and finds it by username", async () => {
    await repo.create({ username: "alice", passwordHash: "hash", email: "a@b.com" });

    const account = await repo.findByUsername("alice");
    expect(account).toMatchObject({ username: "alice", password_hash: "hash" });
    expect(account.id).toEqual(expect.any(Number));
  });

  it("returns null for a username that does not exist (not-found contract)", async () => {
    expect(await repo.findByUsername("ghost")).toBeNull();
    expect(await repo.findIdByUsername("ghost")).toBeNull();
  });

  it("raises a real unique-violation (23505) on a duplicate username (failure path)", async () => {
    await repo.create({ username: "alice", passwordHash: "hash", email: null });

    await expect(
      repo.create({ username: "alice", passwordHash: "other", email: null }),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("findIdByUsername returns the generated id", async () => {
    await repo.create({ username: "bob", passwordHash: "hash", email: null });
    const id = await repo.findIdByUsername("bob");
    expect(id).toEqual(expect.any(Number));
  });
});
