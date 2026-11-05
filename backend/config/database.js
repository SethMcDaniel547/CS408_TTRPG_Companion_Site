"use strict";

const { Pool } = require("pg");

// One connection pool for the whole process (architecture guide, backend rule 5).
// Never create a pool or client per request.
function createPool(config) {
  return new Pool(config.database);
}

// Idempotent schema creation. Runs once per process; the promise is cached so
// concurrent callers share a single initialization.
function createSchemaInitializer(pool) {
  let schemaPromise;
  return function ensureSchema() {
    if (!schemaPromise) {
      schemaPromise = (async () => {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            username VARCHAR(32) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            email VARCHAR(255)
          )
        `);
        await pool.query(`
          CREATE TABLE IF NOT EXISTS game_rooms (
            id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            roomname VARCHAR(64) NOT NULL,
            gm INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            room_code CHAR(8) UNIQUE NOT NULL
          )
        `);
        await pool.query(
          "CREATE UNIQUE INDEX IF NOT EXISTS idx_game_rooms_room_code ON game_rooms (room_code)",
        );
        await pool.query(
          "CREATE INDEX IF NOT EXISTS idx_game_rooms_gm ON game_rooms (gm)",
        );
        await pool.query(`
          CREATE TABLE IF NOT EXISTS room_members (
            room_id INTEGER NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
            account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (room_id, account_id)
          )
        `);
        await pool.query(
          "CREATE INDEX IF NOT EXISTS idx_room_members_account ON room_members (account_id)",
        );
      })().catch((error) => {
        schemaPromise = undefined;
        throw error;
      });
    }
    return schemaPromise;
  };
}

module.exports = { createPool, createSchemaInitializer };
