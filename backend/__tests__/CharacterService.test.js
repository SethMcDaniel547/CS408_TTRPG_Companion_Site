"use strict";

const { CharacterService } = require("../services/CharacterService");
const { NoteService } = require("../services/NoteService");
const { RoomService } = require("../services/RoomService");

const charRow = (extra = {}) => ({ id: 4, name: "Nyx", info: "bio", has_token: false, updated_at: new Date(5), ...extra });

function makeCharacterService(overrides = {}) {
  const characterRepo = {
    listByAccount: jest.fn().mockResolvedValue([]),
    countByAccount: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockResolvedValue(charRow()),
    update: jest.fn().mockResolvedValue(charRow()),
    deleteOwned: jest.fn().mockResolvedValue(true),
    setToken: jest.fn().mockResolvedValue(charRow({ has_token: true })),
    getTokenForViewer: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
  const accountRepo = { findIdByUsername: jest.fn() };
  return { service: new CharacterService(characterRepo, accountRepo), characterRepo, accountRepo };
}

describe("CharacterService", () => {
  it("lists multiple characters as views", async () => {
    const { service } = makeCharacterService({
      listByAccount: jest.fn().mockResolvedValue([charRow(), charRow({ id: 5, name: "Brom" })]),
    });
    const list = await service.list(1);
    expect(list.map((c) => c.name)).toEqual(["Nyx", "Brom"]);
  });

  it("creates a character for the account", async () => {
    const { service, characterRepo } = makeCharacterService();
    const result = await service.create(7, { name: "Nyx", info: "bio" });
    expect(characterRepo.create).toHaveBeenCalledWith({ accountId: 7, name: "Nyx", info: "bio" });
    expect(result.id).toBe(4);
  });

  it("enforces the per-account character limit", async () => {
    const { service } = makeCharacterService({ countByAccount: jest.fn().mockResolvedValue(25) });
    await expect(service.create(1, { name: "X", info: "" })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("404s when updating, deleting, or uploading for a character not owned", async () => {
    const { service } = makeCharacterService({
      update: jest.fn().mockResolvedValue(null),
      deleteOwned: jest.fn().mockResolvedValue(false),
      setToken: jest.fn().mockResolvedValue(null),
    });
    await expect(service.update(1, 9, { name: "X", info: "" })).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.remove(1, 9)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.saveToken(1, 9, { data: Buffer.from("x"), contentType: "image/png" })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("exposes a token URL once a token is stored", async () => {
    const { service } = makeCharacterService();
    const result = await service.saveToken(1, 4, { data: Buffer.from("x"), contentType: "image/png" });
    expect(result.tokenUrl).toBe("/api/characters/4/token?v=5");
  });

  it("404s when the viewer cannot see a token", async () => {
    const { service } = makeCharacterService();
    await expect(service.getToken(1, 4)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 401 when the session account is gone", async () => {
    const { service, accountRepo } = makeCharacterService();
    accountRepo.findIdByUsername.mockResolvedValue(null);
    await expect(service.requireAccountId("ghost")).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe("NoteService", () => {
  function makeNoteService(overrides = {}) {
    const noteRepo = {
      listForAccount: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 1, character_id: 4, title: "T", body: "", updated_at: new Date(0) }),
      updateOwned: jest.fn().mockResolvedValue(null),
      deleteOwned: jest.fn().mockResolvedValue(false),
      ...overrides.noteRepo,
    };
    const characterRepo = { findOwned: jest.fn().mockResolvedValue(charRow()), ...overrides.characterRepo };
    return { service: new NoteService(noteRepo, characterRepo, {}), noteRepo, characterRepo };
  }

  it("creates a note on an owned character", async () => {
    const { service, noteRepo } = makeNoteService();
    const note = await service.create(1, { characterId: 4, title: "T", body: "" });
    expect(noteRepo.create).toHaveBeenCalledWith({ characterId: 4, title: "T", body: "" });
    expect(note.characterId).toBe(4);
  });

  it("refuses to create a note on someone else's character", async () => {
    const { service, noteRepo } = makeNoteService({ characterRepo: { findOwned: jest.fn().mockResolvedValue(null) } });
    await expect(service.create(1, { characterId: 9, title: "T", body: "" })).rejects.toMatchObject({ statusCode: 404 });
    expect(noteRepo.create).not.toHaveBeenCalled();
  });

  it("404s updating or deleting a note that is not owned", async () => {
    const { service } = makeNoteService();
    await expect(service.update(1, 9, { title: "T", body: "" })).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.remove(1, 9)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("RoomService roster and character selection", () => {
  function makeRoomService({ room = { id: 5, gm: 1 }, isMember = true, owned = charRow() } = {}) {
    const roomRepo = { findById: jest.fn().mockResolvedValue(room) };
    const memberRepo = {
      isMember: jest.fn().mockResolvedValue(isMember),
      setCharacter: jest.fn().mockResolvedValue(undefined),
      listRoster: jest.fn().mockResolvedValue([
        { account_id: 2, character_id: 4, name: "Nyx", has_token: false, updated_at: new Date(0) },
      ]),
    };
    const characterRepo = { findOwned: jest.fn().mockResolvedValue(owned) };
    return { service: new RoomService(roomRepo, memberRepo, {}, characterRepo), memberRepo };
  }

  it("returns character-only roster entries for a member", async () => {
    const { service } = makeRoomService();
    const roster = await service.getRoster(5, 2);
    expect(roster).toEqual([
      { accountId: 2, isSelf: true, characterId: 4, name: "Nyx", tokenUrl: null },
    ]);
  });

  it("blocks the roster for outsiders", async () => {
    const { service } = makeRoomService({ isMember: false });
    await expect(service.getRoster(5, 99)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("records the chosen character for a member", async () => {
    const { service, memberRepo } = makeRoomService();
    await service.selectCharacter(5, 2, 4);
    expect(memberRepo.setCharacter).toHaveBeenCalledWith(5, 2, 4);
  });

  it("rejects selecting a character the player does not own", async () => {
    const { service, memberRepo } = makeRoomService({ owned: null });
    await expect(service.selectCharacter(5, 2, 77)).rejects.toMatchObject({ statusCode: 404 });
    expect(memberRepo.setCharacter).not.toHaveBeenCalled();
  });

  it("ignores character selection for the GM", async () => {
    const { service, memberRepo } = makeRoomService();
    await service.selectCharacter(5, 1, 4);
    expect(memberRepo.setCharacter).not.toHaveBeenCalled();
  });
  describe("getMemberCharacter (GM)", () => {
    function build({ gm = 1, member = true, characterId = 4 } = {}) {
      const roomRepo = { findById: jest.fn().mockResolvedValue({ id: 5, gm }) };
      const memberRepo = {
        isMember: jest.fn().mockResolvedValue(member),
        getCharacterId: jest.fn().mockResolvedValue(characterId),
      };
      const characterRepo = { findOwned: jest.fn().mockResolvedValue(charRow({ has_token: true })) };
      const noteRepo = {
        listForCharacter: jest.fn().mockResolvedValue([{ id: 9, title: "T", body: "b", updated_at: new Date(0) }]),
      };
      return new RoomService(roomRepo, memberRepo, {}, characterRepo, noteRepo);
    }

    it("returns the member's character with its notes", async () => {
      const result = await build().getMemberCharacter(5, 2, 1);
      expect(result.character).toMatchObject({ id: 4, name: "Nyx", tokenUrl: "/api/characters/4/token?v=5" });
      expect(result.notes).toHaveLength(1);
    });

    it("returns an empty result when no character is chosen yet", async () => {
      const result = await build({ characterId: null }).getMemberCharacter(5, 2, 1);
      expect(result).toEqual({ character: null, notes: [] });
    });

    it("rejects non-GMs and non-members", async () => {
      await expect(build().getMemberCharacter(5, 2, 3)).rejects.toMatchObject({ statusCode: 403 });
      await expect(build({ member: false }).getMemberCharacter(5, 2, 1)).rejects.toMatchObject({ statusCode: 404 });
    });
  });});
