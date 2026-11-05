"use strict";

// Repository for game_rooms. Raw SQL lives here only; parameterized throughout;
// not-found returns null. Optional `client` supports transactions (rule 7).
class RoomRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async roomCodeExists(code, client = this.pool) {
    const { rowCount } = await client.query(
      "SELECT 1 FROM game_rooms WHERE room_code = $1",
      [code],
    );
    return rowCount > 0;
  }

  async findByCode(code, client = this.pool) {
    const { rows } = await client.query(
      "SELECT id, roomname, room_code, gm FROM game_rooms WHERE room_code = $1",
      [code],
    );
    return rows[0] ?? null;
  }

  async findById(id, client = this.pool) {
    const { rows } = await client.query(
      "SELECT id, roomname, room_code, gm FROM game_rooms WHERE id = $1",
      [id],
    );
    return rows[0] ?? null;
  }

  async listForAccount(accountId, client = this.pool) {
    const { rows } = await client.query(
      `SELECT r.id, r.roomname, r.room_code, r.gm,
              (SELECT COUNT(*) FROM room_members m WHERE m.room_id = r.id) AS player_count
         FROM game_rooms r
        WHERE r.gm = $1
           OR EXISTS (SELECT 1 FROM room_members m WHERE m.room_id = r.id AND m.account_id = $1)
        ORDER BY r.roomname ASC`,
      [accountId],
    );
    return rows;
  }

  async create({ roomname, gm, roomCode }, client = this.pool) {
    const { rows } = await client.query(
      "INSERT INTO game_rooms (roomname, gm, room_code) VALUES ($1, $2, $3) RETURNING id, roomname, room_code, gm",
      [roomname, gm, roomCode],
    );
    return rows[0];
  }

  async deleteById(id, client = this.pool) {
    await client.query("DELETE FROM game_rooms WHERE id = $1", [id]);
  }
}

module.exports = { RoomRepository };
