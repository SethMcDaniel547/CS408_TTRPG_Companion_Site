"use strict";

const { Pool } = require("pg");

// Shared helpers for repository integration tests. The connection string comes
// from TEST_DATABASE_URL (set by docker-compose.test.yml defaults). The suite is
// opt-in: if the variable is absent the tests skip themselves rather than fail,
// so `npm test` stays runnable without Docker.

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://ttrpg_test:ttrpg_test@127.0.0.1:55432/ttrpg_companion_test";

function createTestPool() {
  return new Pool({ connectionString: TEST_DATABASE_URL });
}

// Wipes all data and resets identity sequences between tests. CASCADE handles
// the foreign keys; RESTART IDENTITY keeps generated ids predictable per test.
async function resetTables(pool) {
  await pool.query(
    "TRUNCATE accounts, game_rooms, room_members, characters RESTART IDENTITY CASCADE",
  );
}

module.exports = { TEST_DATABASE_URL, createTestPool, resetTables };
