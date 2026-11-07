"use strict";

// Repository for characters. Raw SQL lives here only; parameterized; not-found
// returns null. Optional `client` supports transactions (rule 7).
class CharacterRepository {
  constructor(pool) {
    this.pool = pool;
  }

  // Metadata only: the token bytes are never loaded unless explicitly asked for.
  async findByAccount(accountId, client = this.pool) {
    const { rows } = await client.query(
      `SELECT account_id, name, info, (token_data IS NOT NULL) AS has_token, updated_at
         FROM characters WHERE account_id = $1`,
      [accountId],
    );
    return rows[0] ?? null;
  }

  async upsert({ accountId, name, info }, client = this.pool) {
    const { rows } = await client.query(
      `INSERT INTO characters (account_id, name, info)
            VALUES ($1, $2, $3)
       ON CONFLICT (account_id)
         DO UPDATE SET name = EXCLUDED.name, info = EXCLUDED.info, updated_at = now()
         RETURNING account_id, name, info, (token_data IS NOT NULL) AS has_token, updated_at`,
      [accountId, name, info],
    );
    return rows[0];
  }

  async setToken({ accountId, data, contentType }, client = this.pool) {
    const { rows } = await client.query(
      `INSERT INTO characters (account_id, token_data, token_type)
            VALUES ($1, $2, $3)
       ON CONFLICT (account_id)
         DO UPDATE SET token_data = EXCLUDED.token_data,
                       token_type = EXCLUDED.token_type,
                       updated_at = now()
         RETURNING account_id, name, info, (token_data IS NOT NULL) AS has_token, updated_at`,
      [accountId, data, contentType],
    );
    return rows[0];
  }

  async getToken(accountId, client = this.pool) {
    const { rows } = await client.query(
      "SELECT token_data, token_type FROM characters WHERE account_id = $1 AND token_data IS NOT NULL",
      [accountId],
    );
    if (!rows[0]) return null;
    return { data: rows[0].token_data, contentType: rows[0].token_type };
  }
}

module.exports = { CharacterRepository };
