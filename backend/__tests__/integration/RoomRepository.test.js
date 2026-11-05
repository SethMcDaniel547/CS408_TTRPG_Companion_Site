"use strict";

// Integration tests: RoomRepository against a real Postgres (testing rule 2).
// Exercises CHAR(8) round-tripping, the listForAccount visibility logic, the
// player_count subquery, and FK ON DELETE CASCADE.
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

describe("RoomRepository (integration)", () => {
  it("creates a room and finds it by its CHAR(8) code", async () => {
    const gm = await makeAccount("gm");
    const created = await rooms.create({ roomname: "The Lost Mine", gm, roomCode: "ABCD2345" });

    expect(created).toMatchObject({ roomname: "The Lost Mine", gm });

    const found = await rooms.findByCode("ABCD2345");
    expect(found).not.toBeNull();
    // CHAR(8) stores exactly 8 chars; the service trims it. Confirm the stored
    // value matches once trimmed so no hidden padding bug slips through.
    expect(found.room_code.trim()).toBe("ABCD2345");
  });

  it("roomCodeExists reflects reality", async () => {
    const gm = await makeAccount("gm");
    expect(await rooms.roomCodeExists("ZZZZ9999")).toBe(false);
    await rooms.create({ roomname: "R", gm, roomCode: "ZZZZ9999" });
    expect(await rooms.roomCodeExists("ZZZZ9999")).toBe(true);
  });

  it("returns null for a missing room by id or code (not-found contract)", async () => {
    expect(await rooms.findById(999999)).toBeNull();
    expect(await rooms.findByCode("NOPENOPE")).toBeNull();
  });

  it("lists rooms the account owns or belongs to, with correct player counts", async () => {
    const gm = await makeAccount("gm");
    const player = await makeAccount("player");
    const stranger = await makeAccount("stranger");

    const owned = await rooms.create({ roomname: "Owned", gm, roomCode: "OWNED111" });
    const joined = await rooms.create({ roomname: "Joined", gm: stranger, roomCode: "JOINED22" });
    await rooms.create({ roomname: "Hidden", gm: stranger, roomCode: "HIDDEN33" });

    // gm owns "Owned"; also joins "Joined" as a member.
    await members.add(joined.id, gm);
    // give "Owned" one player so player_count is exercised.
    await members.add(owned.id, player);

    const listed = await rooms.listForAccount(gm);
    const byName = Object.fromEntries(listed.map((r) => [r.roomname, r]));

    expect(Object.keys(byName).sort()).toEqual(["Joined", "Owned"]);
    expect(byName.Hidden).toBeUndefined();
    expect(Number(byName.Owned.player_count)).toBe(1);
    expect(byName.Owned.gm).toBe(gm);
  });

  it("deletes a room and cascades to its room_members rows (FK ON DELETE CASCADE)", async () => {
    const gm = await makeAccount("gm");
    const player = await makeAccount("player");
    const room = await rooms.create({ roomname: "Doomed", gm, roomCode: "DOOMED11" });
    await members.add(room.id, player);

    expect(await members.countForRoom(room.id)).toBe(1);

    await rooms.deleteById(room.id);

    expect(await rooms.findById(room.id)).toBeNull();
    // The junction rows must be gone, proving the cascade fired.
    expect(await members.countForRoom(room.id)).toBe(0);
  });
});
