"use strict";

const { RoomService } = require("../services/RoomService");
const { validateNotePass } = require("../validation/validators");

describe("validateNotePass", () => {
  it("accepts a recipient and text", () => {
    expect(validateNotePass({ toAccountId: "4", text: "psst" })).toEqual({ toAccountId: 4, text: "psst" });
  });

  it("rejects a bad recipient, empty text, and oversized text", () => {
    expect(() => validateNotePass({ text: "hi" })).toThrow();
    expect(() => validateNotePass({ toAccountId: 0, text: "hi" })).toThrow();
    expect(() => validateNotePass({ toAccountId: 2, text: "   " })).toThrow();
    expect(() => validateNotePass({ toAccountId: 2, text: 5 })).toThrow();
    expect(() => validateNotePass({ toAccountId: 2, text: "x".repeat(1001) })).toThrow();
    expect(() => validateNotePass(undefined)).toThrow();
  });
});

describe("RoomService.requireNotePassage", () => {
  const GM = 1;
  function build(members = [2, 3]) {
    const roomRepo = { findById: jest.fn().mockResolvedValue({ id: 5, gm: GM }) };
    const memberRepo = { isMember: jest.fn(async (_room, id) => members.includes(id)) };
    return new RoomService(roomRepo, memberRepo, {}, {}, {});
  }

  it("allows one player to pass a note to another", async () => {
    await expect(build().requireNotePassage(5, 2, 3)).resolves.toBeUndefined();
  });

  it("rejects passing to yourself", async () => {
    await expect(build().requireNotePassage(5, 2, 2)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("allows the GM to pass a note to a player", async () => {
    await expect(build().requireNotePassage(5, GM, 2)).resolves.toBeUndefined();
  });

  it("rejects the GM as recipient", async () => {
    await expect(build().requireNotePassage(5, 2, GM)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects a sender outside the room", async () => {
    await expect(build().requireNotePassage(5, 9, 2)).rejects.toMatchObject({ statusCode: 403 });
  });
});
