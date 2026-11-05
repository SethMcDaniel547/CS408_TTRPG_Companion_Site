"use strict";

// Repository for room_members. Raw SQL lives here only; parameterized throughout.
// Optional `client` supports transactions (rule 7).
class MemberRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async add(roomId, accountId, client = this.pool) {
    await client.query(
      "INSERT INTO room_members (room_id, account_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [roomId, accountId],
    );
  }

  async remove(roomId, accountId, client = this.pool) {
    await client.query(
      "DELETE FROM room_members WHERE room_id = $1 AND account_id = $2",
      [roomId, accountId],
    );
  }

  async countForRoom(roomId, client = this.pool) {
    const { rows } = await client.query(
      "SELECT COUNT(*) AS player_count FROM room_members WHERE room_id = $1",
      [roomId],
    );
    return Number.parseInt(rows[0].player_count, 10) || 0;
  }

  async listForRoom(roomId, client = this.pool) {
    const { rows } = await client.query(
      `SELECT a.id, a.username
         FROM room_members m
         JOIN accounts a ON a.id = m.account_id
        WHERE m.room_id = $1
        ORDER BY a.username ASC`,
      [roomId],
    );
    return rows;
  }
}

module.exports = { MemberRepository };
