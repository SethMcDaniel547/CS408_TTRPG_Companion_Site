"use strict";

// Integration tests: MemberRepository against a real Postgres (testing rule 2).
// Covers the composite-key JOIN, idempotent inserts (ON CONFLICT DO NOTHING),
// and the optional-`client` transaction support required by rule 7.
const { AccountRepository } = require("../../repositories/AccountRepository");
const { RoomRepository } = require("../../repositories/RoomRepository");
const { MemberRepository } = require("../../repositories/MemberRepository");
const { createTestPool, resetTables } = require("./testDatabase");

let pool;
let accounts;
let rooms;
let members;

beforeAll(() => {
  pool = createTestPool();
  accounts = new AccountRepository(pool);
  rooms = new RoomRepository(pool);
  members = new MemberRepository(pool);
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

async function makeRoom(gm, code = "ROOMCODE") {
  return rooms.create({ roomname: "Room", gm, roomCode: code });
}

describe("MemberRepository (integration)", () => {
  it("adds a member and lists them joined to their account username", async () => {
    const gm = await makeAccount("gm");
    const player = await makeAccount("rogue_pc");
    const room = await makeRoom(gm);

    await members.add(room.id, player);
    const roster = await members.listForRoom(room.id);

    expect(roster).toEqual([{ id: player, username: "rogue_pc" }]);
    expect(await members.countForRoom(room.id)).toBe(1);
  });

  it("is idempotent on duplicate adds (ON CONFLICT DO NOTHING)", async () => {
    const gm = await makeAccount("gm");
    const player = await makeAccount("player");
    const room = await makeRoom(gm);

    await members.add(room.id, player);
    await members.add(room.id, player); // must not throw, must not double-count

    expect(await members.countForRoom(room.id)).toBe(1);
  });

  it("removes a member", async () => {
    const gm = await makeAccount("gm");
    const player = await makeAccount("player");
    const room = await makeRoom(gm);

    await members.add(room.id, player);
    await members.remove(room.id, player);

    expect(await members.countForRoom(room.id)).toBe(0);
  });

  it("honours an injected client so writes share one transaction (rule 7)", async () => {
    const gm = await makeAccount("gm");
    const p1 = await makeAccount("p1");
    const p2 = await makeAccount("p2");
    const room = await makeRoom(gm);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await members.add(room.id, p1, client);
      await members.add(room.id, p2, client);
      // Inside the open transaction the rows are visible to this client...
      expect(await members.countForRoom(room.id, client)).toBe(2);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }

    // ...but after ROLLBACK nothing persisted, proving the client was actually
    // used for both writes rather than the default pool.
    expect(await members.countForRoom(room.id)).toBe(0);
  });
});
