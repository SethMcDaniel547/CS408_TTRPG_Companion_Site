"use strict";

const crypto = require("node:crypto");
const { AppError } = require("../errors/AppError");

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Business rules for rooms and membership. No req/res, no raw SQL, no driver
// imports. Repositories are injected via the constructor.
class RoomService {
  constructor(roomRepo, memberRepo, accountRepo) {
    this.roomRepo = roomRepo;
    this.memberRepo = memberRepo;
    this.accountRepo = accountRepo;
  }

  // Resolves a session username to an account id, or throws if the account has
  // disappeared (e.g. deleted while a session was live).
  async requireAccountId(username) {
    const accountId = await this.accountRepo.findIdByUsername(username);
    if (!accountId) {
      throw new AppError("Your account could not be found.", 401);
    }
    return accountId;
  }

  static view(row, accountId) {
    return {
      id: row.id,
      roomname: row.roomname,
      roomCode: row.room_code.trim(),
      isGm: row.gm === accountId,
      playerCount: Number.parseInt(row.player_count, 10) || 0,
    };
  }

  generateRoomCode() {
    const bytes = crypto.randomBytes(8);
    let code = "";
    for (let index = 0; index < 8; index += 1) {
      code += ROOM_CODE_ALPHABET[bytes[index] % ROOM_CODE_ALPHABET.length];
    }
    return code;
  }

  async createUniqueRoomCode() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = this.generateRoomCode();
      if (!(await this.roomRepo.roomCodeExists(code))) return code;
    }
    throw new AppError("Unable to generate a unique room code.", 503);
  }

  async listForAccount(accountId) {
    const rows = await this.roomRepo.listForAccount(accountId);
    return rows.map((row) => RoomService.view(row, accountId));
  }

  async createRoom(accountId, roomname) {
    const roomCode = await this.createUniqueRoomCode();
    const row = await this.roomRepo.create({ roomname, gm: accountId, roomCode });
    return RoomService.view({ ...row, player_count: 0 }, accountId);
  }

  async joinRoom(accountId, roomCode) {
    const room = await this.roomRepo.findByCode(roomCode);
    if (!room) {
      throw new AppError("No room matches that code.", 404);
    }
    // The GM is never inserted as a player (membership is implied by the gm column).
    if (room.gm !== accountId) {
      await this.memberRepo.add(room.id, accountId);
    }
    const playerCount = await this.memberRepo.countForRoom(room.id);
    return RoomService.view({ ...room, player_count: playerCount }, accountId);
  }

  // Loads a room and confirms the caller is its GM; throws typed errors otherwise.
  async requireOwnedRoom(roomId, accountId) {
    const room = await this.roomRepo.findById(roomId);
    if (!room) {
      throw new AppError("Room not found.", 404);
    }
    if (room.gm !== accountId) {
      throw new AppError("Only the GM can manage this room.", 403);
    }
    return room;
  }

  async listMembers(roomId, accountId) {
    await this.requireOwnedRoom(roomId, accountId);
    return this.memberRepo.listForRoom(roomId);
  }

  async addMember(roomId, accountId, username) {
    await this.requireOwnedRoom(roomId, accountId);
    const memberId = await this.accountRepo.findIdByUsername(username);
    if (!memberId) {
      throw new AppError("No account with that username.", 404);
    }
    if (memberId === accountId) {
      throw new AppError("The GM is already in the room.", 400);
    }
    await this.memberRepo.add(roomId, memberId);
    return this.memberRepo.listForRoom(roomId);
  }

  async removeMember(roomId, memberId, accountId) {
    await this.requireOwnedRoom(roomId, accountId);
    await this.memberRepo.remove(roomId, memberId);
    return this.memberRepo.listForRoom(roomId);
  }

  async deleteRoom(roomId, accountId) {
    await this.requireOwnedRoom(roomId, accountId);
    await this.roomRepo.deleteById(roomId);
  }
}

module.exports = { RoomService };
