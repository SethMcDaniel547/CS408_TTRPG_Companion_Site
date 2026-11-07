"use strict";

// Repository for notes. A note belongs to a character, which belongs to an
// account, so every read/write joins through characters to enforce ownership in
// SQL. Parameterized throughout; not-found returns null.
const NOTE_COLUMNS = "n.id, n.character_id, n.title, n.body, n.updated_at";

class NoteRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async listForAccount(accountId, client = this.pool) {
    const { rows } = await client.query(
      `SELECT ${NOTE_COLUMNS}
         FROM notes n
         JOIN characters c ON c.id = n.character_id
        WHERE c.account_id = $1
        ORDER BY lower(n.title) ASC, n.id ASC`,
      [accountId],
    );
    return rows;
  }

  async listForCharacter(characterId, client = this.pool) {
    const { rows } = await client.query(
      `SELECT id, character_id, title, body, updated_at FROM notes
        WHERE character_id = $1 ORDER BY lower(title) ASC, id ASC`,
      [characterId],
    );
    return rows;
  }

  async create({ characterId, title, body }, client = this.pool) {
    const { rows } = await client.query(
      `INSERT INTO notes (character_id, title, body) VALUES ($1, $2, $3)
       RETURNING id, character_id, title, body, updated_at`,
      [characterId, title, body],
    );
    return rows[0];
  }

  async updateOwned({ id, accountId, title, body }, client = this.pool) {
    const { rows } = await client.query(
      `UPDATE notes n SET title = $3, body = $4, updated_at = now()
         FROM characters c
        WHERE n.id = $1 AND c.id = n.character_id AND c.account_id = $2
        RETURNING ${NOTE_COLUMNS}`,
      [id, accountId, title, body],
    );
    return rows[0] ?? null;
  }

  async deleteOwned(id, accountId, client = this.pool) {
    const { rowCount } = await client.query(
      `DELETE FROM notes n USING characters c
        WHERE n.id = $1 AND c.id = n.character_id AND c.account_id = $2`,
      [id, accountId],
    );
    return rowCount > 0;
  }
}

module.exports = { NoteRepository };
