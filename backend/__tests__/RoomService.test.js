"use strict";

// Unit tests for RoomService with mock repositories injected via the constructor
// (architecture testing rule 1). Covers happy and failure paths.
const { RoomService } = require("../services/RoomService");

function makeService(overrides = {}) {
  const roomRepo = {
    roomCodeExists: jest.fn().mockResolvedValue(false),
    findByCode: jest.fn(),
    findById: jest.fn(),
    listForAccount: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    deleteById: jest.fn().mockResolvedValue(undefined),
    ...overrides.roomRepo,
  };
  const memberRepo = {
    add: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    countForRoom: jest.fn().mockResolvedValue(0),
    listForRoom: jest.fn().mockResolvedValue([]),
    ...overrides.memberRepo,
  };
  const accountRepo = {
    findIdByUsername: jest.fn(),
    ...overrides.accountRepo,
  };
  return { service: new RoomService(roomRepo, memberRepo, accountRepo), roomRepo, memberRepo, accountRepo };
}

describe("RoomService.createRoom", () => {
  it("generates a unique code and persists the room as GM-owned", async () => {
    const { service, roomRepo } = makeService({
      roomRepo: {
        roomCodeExists: jest.fn().mockResolvedValue(false),
        create: jest.fn().mockResolvedValue({ id: 7, roomname: "Mine", room_code: "ABCD2345", gm: 3 }),
      },
    });

    const room = await service.createRoom(3, "Mine");

    expect(roomRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ roomname: "Mine", gm: 3 }),
    );
    expect(room).toEqual({
      id: 7,
      roomname: "Mine",
      roomCode: "ABCD2345",
      isGm: true,
      playerCount: 0,
    });
  });

  it("throws 503 when it cannot find a free code after retries (failure path)", async () => {
    const { service } = makeService({
      roomRepo: { roomCodeExists: jest.fn().mockResolvedValue(true) },
    });
    await expect(service.createRoom(1, "Mine")).rejects.toMatchObject({ statusCode: 503 });
  });
});

describe("RoomService.joinRoom", () => {
  it("adds a non-GM caller as a member", async () => {
    const { service, memberRepo } = makeService({
      roomRepo: {
        findByCode: jest.fn().mockResolvedValue({ id: 5, roomname: "Mine", room_code: "ABCD2345", gm: 99 }),
      },
      memberRepo: { countForRoom: jest.fn().mockResolvedValue(2) },
    });

    const room = await service.joinRoom(42, "ABCD2345");

    expect(memberRepo.add).toHaveBeenCalledWith(5, 42);
    expect(room.playerCount).toBe(2);
    expect(room.isGm).toBe(false);
  });

  it("does not add the GM as a member when they join their own room", async () => {
    const { service, memberRepo } = makeService({
      roomRepo: {
        findByCode: jest.fn().mockResolvedValue({ id: 5, roomname: "Mine", room_code: "ABCD2345", gm: 42 }),
      },
    });

    const room = await service.joinRoom(42, "ABCD2345");

    expect(memberRepo.add).not.toHaveBeenCalled();
    expect(room.isGm).toBe(true);
  });

  it("throws 404 for an unknown code (failure path)", async () => {
    const { service } = makeService({
      roomRepo: { findByCode: jest.fn().mockResolvedValue(null) },
    });
    await expect(service.joinRoom(1, "ZZZZ9999")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("RoomService ownership checks", () => {
  it("rejects a non-GM trying to manage a room with 403 (failure path)", async () => {
    const { service } = makeService({
      roomRepo: { findById: jest.fn().mockResolvedValue({ id: 5, gm: 99, roomname: "x", room_code: "y" }) },
    });
    await expect(service.listMembers(5, 42)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects management of a missing room with 404 (failure path)", async () => {
    const { service } = makeService({
      roomRepo: { findById: jest.fn().mockResolvedValue(null) },
    });
    await expect(service.deleteRoom(5, 42)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects adding the GM themselves with 400 (failure path)", async () => {
    const { service } = makeService({
      roomRepo: { findById: jest.fn().mockResolvedValue({ id: 5, gm: 42, roomname: "x", room_code: "y" }) },
      accountRepo: { findIdByUsername: jest.fn().mockResolvedValue(42) },
    });
    await expect(service.addMember(5, 42, "theGM")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("adds a valid member and returns the updated roster", async () => {
    const { service, memberRepo } = makeService({
      roomRepo: { findById: jest.fn().mockResolvedValue({ id: 5, gm: 42, roomname: "x", room_code: "y" }) },
      accountRepo: { findIdByUsername: jest.fn().mockResolvedValue(7) },
      memberRepo: { listForRoom: jest.fn().mockResolvedValue([{ id: 7, username: "rogue" }]) },
    });

    const members = await service.addMember(5, 42, "rogue");

    expect(memberRepo.add).toHaveBeenCalledWith(5, 7);
    expect(members).toEqual([{ id: 7, username: "rogue" }]);
  });
});
