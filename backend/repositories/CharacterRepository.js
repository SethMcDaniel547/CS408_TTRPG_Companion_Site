"use strict";

// Repository for characters. Raw SQL lives here only; parameterized; not-found
// returns null. Optional `client` supports transactions (rule 7). Token bytes
// are only loaded by getTokenForViewer.
const COLUMNS =
  "id, account_id, name, info, (token_data IS NOT NULL) AS has_token, updated_at";

class CharacterRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async listByAccount(accountId, client = this.pool) {
    const { rows } = await client.query(
      `SELECT ${COLUMNS} FROM characters WHERE account_id = $1 ORDER BY lower(name) ASC, id ASC`,
      [accountId],
    );
    return rows;
  }

  async countByAccount(accountId, client = this.pool) {
    const { rows } = await client.query(
      "SELECT COUNT(*) AS total FROM characters WHERE account_id = $1",
      [accountId],
    );
    return Number.parseInt(rows[0].total, 10) || 0;
  }

  async findOwned(id, accountId, client = this.pool) {
    const { rows } = await client.query(
      `SELECT ${COLUMNS} FROM characters WHERE id = $1 AND account_id = $2`,
      [id, accountId],
    );
    return rows[0] ?? null;
  }

  async create({ accountId, name, info }, client = this.pool) {
    const { rows } = await client.query(
      `INSERT INTO characters (account_id, name, info) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
      [accountId, name, info],
    );
    return rows[0];
  }

  async update({ id, accountId, name, info }, client = this.pool) {
    const { rows } = await client.query(
      `UPDATE characters SET name = $3, info = $4, updated_at = now()
        WHERE id = $1 AND account_id = $2 RETURNING ${COLUMNS}`,
      [id, accountId, name, info],
    );
    return rows[0] ?? null;
  }

  async deleteOwned(id, accountId, client = this.pool) {
    const { rowCount } = await client.query(
      "DELETE FROM characters WHERE id = $1 AND account_id = $2",
      [id, accountId],
    );
    return rowCount > 0;
  }

  async setToken({ id, accountId, data, contentType }, client = this.pool) {
    const { rows } = await client.query(
      `UPDATE characters SET token_data = $3, token_type = $4, updated_at = now()
        WHERE id = $1 AND account_id = $2 RETURNING ${COLUMNS}`,
      [id, accountId, data, contentType],
    );
    return rows[0] ?? null;
  }

  // A token is visible to its owner, and to anyone in a room (as GM or member)
  // where that character is currently being played.
  async getTokenForViewer(id, viewerId, client = this.pool) {
    const { rows } = await client.query(
      `SELECT c.token_data, c.token_type
         FROM characters c
        WHERE c.id = $1
          AND c.token_data IS NOT NULL
          AND (
            c.account_id = $2
            OR EXISTS (
              SELECT 1
                FROM room_members pm
                JOIN game_rooms r ON r.id = pm.room_id
               WHERE pm.character_id = c.id
                 AND (
                   r.gm = $2
                   OR EXISTS (
                     SELECT 1 FROM room_members me
                      WHERE me.room_id = r.id AND me.account_id = $2
                   )
                 )
            )
          )`,
      [id, viewerId],
    );
    if (!rows[0]) return null;
    return { data: rows[0].token_data, contentType: rows[0].token_type };
  }
}

module.exports = { CharacterRepository };
