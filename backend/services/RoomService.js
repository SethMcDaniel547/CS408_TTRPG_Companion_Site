"use strict";

const crypto = require("node:crypto");
const { AppError } = require("../errors/AppError");

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Business rules for rooms and membership. No req/res, no raw SQL, no driver
// imports. Repositories are injected via the constructor.
class RoomService {
  constructor(roomRepo, memberRepo, accountRepo, characterRepo, noteRepo) {
    this.roomRepo = roomRepo;
    this.memberRepo = memberRepo;
    this.accountRepo = accountRepo;
    this.characterRepo = characterRepo;
    this.noteRepo = noteRepo;
  }

  // GM-only: the character a member is playing in this room, with its notes.
  // Returns { character: null, notes: [] } if the member has not picked one yet.
  async getMemberCharacter(roomId, memberId, accountId) {
    await this.requireOwnedRoom(roomId, accountId);
    if (!(await this.memberRepo.isMember(roomId, memberId))) {
      throw new AppError("That player is not in this room.", 404);
    }
    const characterId = await this.memberRepo.getCharacterId(roomId, memberId);
    const row = characterId ? await this.characterRepo.findOwned(characterId, memberId) : null;
    if (!row) return { character: null, notes: [] };
    const notes = await this.noteRepo.listForCharacter(row.id);
    return {
      character: {
        id: row.id,
        name: row.name,
        info: row.info,
        tokenUrl: row.has_token
          ? `/api/characters/${row.id}/token?v=${new Date(row.updated_at).getTime()}`
          : null,
      },
      notes: notes.map((note) => ({
        id: note.id,
        title: note.title,
        body: note.body,
        updatedAt: new Date(note.updated_at).toISOString(),
      })),
    };
  }

  // Loads a room the caller may see (its GM or a member); throws otherwise.
  async requireRoomAccess(roomId, accountId) {
    const room = await this.roomRepo.findById(roomId);
    if (!room) {
      throw new AppError("Room not found.", 404);
    }
    if (room.gm !== accountId && !(await this.memberRepo.isMember(roomId, accountId))) {
      throw new AppError("You are not in this room.", 403);
    }
    return room;
  }

  // Player grid data: the character each member is playing. No usernames.
  async getRoster(roomId, accountId) {
    await this.requireRoomAccess(roomId, accountId);
    const rows = await this.memberRepo.listRoster(roomId);
    return rows.map((row) => ({
      accountId: row.account_id,
      isSelf: row.account_id === accountId,
      characterId: row.character_id,
      name: row.name,
      tokenUrl: row.has_token
        ? `/api/characters/${row.character_id}/token?v=${new Date(row.updated_at).getTime()}`
        : null,
    }));
  }

  // Records which of the caller's characters they play in this room. The GM
  // does not play a character, so the call is a no-op for them.
  async selectCharacter(roomId, accountId, characterId) {
    const room = await this.requireRoomAccess(roomId, accountId);
    if (room.gm === accountId) return;
    if (!(await this.characterRepo.findOwned(characterId, accountId))) {
      throw new AppError("Character not found.", 404);
    }
    await this.memberRepo.setCharacter(roomId, accountId, characterId);
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
