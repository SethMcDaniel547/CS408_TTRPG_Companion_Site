"use strict";

const { AccountRepository } = require("../../repositories/AccountRepository");
const { CharacterRepository } = require("../../repositories/CharacterRepository");
const { RoomRepository } = require("../../repositories/RoomRepository");
const { MemberRepository } = require("../../repositories/MemberRepository");
const { NoteRepository } = require("../../repositories/NoteRepository");
const { createTestPool, resetTables } = require("./testDatabase");

let pool;
let accounts;
let characters;
let rooms;
let members;
let notes;

beforeAll(() => {
  pool = createTestPool();
  accounts = new AccountRepository(pool);
  characters = new CharacterRepository(pool);
  rooms = new RoomRepository(pool);
  members = new MemberRepository(pool);
  notes = new NoteRepository(pool);
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
  it("lets one account own several characters", async () => {
    const id = await makeAccount("alice");
    await characters.create({ accountId: id, name: "Nyx", info: "" });
    await characters.create({ accountId: id, name: "Brom", info: "" });
    const list = await characters.listByAccount(id);
    expect(list.map((c) => c.name)).toEqual(["Brom", "Nyx"]);
    expect(await characters.countByAccount(id)).toBe(2);
  });

  it("only updates, tokens, and deletes characters the account owns", async () => {
    const alice = await makeAccount("alice");
    const bob = await makeAccount("bob");
    const c = await characters.create({ accountId: alice, name: "Nyx", info: "" });

    expect(await characters.update({ id: c.id, accountId: bob, name: "Hax", info: "" })).toBeNull();
    expect(await characters.setToken({ id: c.id, accountId: bob, data: Buffer.from([1]), contentType: "image/png" })).toBeNull();
    expect(await characters.deleteOwned(c.id, bob)).toBe(false);

    const updated = await characters.update({ id: c.id, accountId: alice, name: "Renamed", info: "x" });
    expect(updated).toMatchObject({ name: "Renamed", info: "x" });
    expect(await characters.deleteOwned(c.id, alice)).toBe(true);
  });

  it("shows a token only to its owner or people in a room where it is played", async () => {
    const gm = await makeAccount("gm");
    const player = await makeAccount("player");
    const other = await makeAccount("other");
    const outsider = await makeAccount("outsider");
    const room = await rooms.create({ roomname: "R", gm, roomCode: "ROOMCODE" });
    await members.add(room.id, player);
    await members.add(room.id, other);

    const c = await characters.create({ accountId: player, name: "Nyx", info: "" });
    const data = Buffer.from([1, 2, 3]);
    await characters.setToken({ id: c.id, accountId: player, data, contentType: "image/png" });

    expect((await characters.getTokenForViewer(c.id, player)).data.equals(data)).toBe(true);
    // Not yet played in the room: roommates cannot see it.
    expect(await characters.getTokenForViewer(c.id, gm)).toBeNull();

    await members.setCharacter(room.id, player, c.id);
    expect(await characters.getTokenForViewer(c.id, gm)).not.toBeNull();
    expect(await characters.getTokenForViewer(c.id, other)).not.toBeNull();
    expect(await characters.getTokenForViewer(c.id, outsider)).toBeNull();
  });

  it("builds a roster with the character each member plays", async () => {
    const gm = await makeAccount("gm");
    const player = await makeAccount("player");
    const waiting = await makeAccount("waiting");
    const room = await rooms.create({ roomname: "R", gm, roomCode: "ROOMCODE" });
    await members.add(room.id, player);
    await members.add(room.id, waiting);
    const c = await characters.create({ accountId: player, name: "Nyx", info: "" });
    await members.setCharacter(room.id, player, c.id);

    const roster = await members.listRoster(room.id);
    expect(roster).toHaveLength(2);
    expect(roster.find((r) => r.account_id === player)).toMatchObject({ name: "Nyx", has_token: false });
    expect(roster.find((r) => r.account_id === waiting).name).toBeNull();
  });

  it("deleting a character clears it from the room and removes its notes", async () => {
    const gm = await makeAccount("gm");
    const player = await makeAccount("player");
    const room = await rooms.create({ roomname: "R", gm, roomCode: "ROOMCODE" });
    await members.add(room.id, player);
    const c = await characters.create({ accountId: player, name: "Nyx", info: "" });
    await members.setCharacter(room.id, player, c.id);
    await notes.create({ characterId: c.id, title: "N", body: "b" });

    await characters.deleteOwned(c.id, player);
    expect((await members.listRoster(room.id))[0].character_id).toBeNull();
    expect(await notes.listForAccount(player)).toEqual([]);
  });
});

describe("NoteRepository (integration)", () => {
  it("scopes notes to the owning account", async () => {
    const alice = await makeAccount("alice");
    const bob = await makeAccount("bob");
    const c = await characters.create({ accountId: alice, name: "Nyx", info: "" });
    const note = await notes.create({ characterId: c.id, title: "Plan", body: "one" });

    expect((await notes.listForAccount(alice)).map((n) => n.title)).toEqual(["Plan"]);
    expect(await notes.listForAccount(bob)).toEqual([]);
    expect(await notes.updateOwned({ id: note.id, accountId: bob, title: "x", body: "x" })).toBeNull();
    expect(await notes.deleteOwned(note.id, bob)).toBe(false);

    const updated = await notes.updateOwned({ id: note.id, accountId: alice, title: "Plan B", body: "two" });
    expect(updated).toMatchObject({ title: "Plan B", body: "two" });
    expect(await notes.deleteOwned(note.id, alice)).toBe(true);
  });
});
