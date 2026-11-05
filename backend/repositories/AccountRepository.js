"use strict";

// Repository: the only place raw SQL and pool.query may appear (architecture
// guide, backend rule 4). All queries are parameterized; not-found returns null.
// Every method accepts an optional `client` so a service can run it inside a
// shared BEGIN...COMMIT transaction (rule 7); it defaults to the pool.
class AccountRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create({ username, passwordHash, email }, client = this.pool) {
    await client.query(
      "INSERT INTO accounts (username, password_hash, email) VALUES ($1, $2, $3)",
      [username, passwordHash, email],
    );
  }

  async findByUsername(username, client = this.pool) {
    const { rows } = await client.query(
      "SELECT id, username, password_hash FROM accounts WHERE username = $1",
      [username],
    );
    return rows[0] ?? null;
  }

  async findIdByUsername(username, client = this.pool) {
    const { rows } = await client.query(
      "SELECT id FROM accounts WHERE username = $1",
      [username],
    );
    return rows[0]?.id ?? null;
  }
}

module.exports = { AccountRepository };
