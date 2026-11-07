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
        // Characters: an account can own many. The token image is stored inline
        // (small, size-capped) so no shared filesystem is needed across instances.
        await pool.query(`
          CREATE TABLE IF NOT EXISTS characters (
            id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            name VARCHAR(80) NOT NULL DEFAULT '',
            info TEXT NOT NULL DEFAULT '',
            token_data BYTEA,
            token_type VARCHAR(32),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `);
        // Upgrade path from the checkpoint-4 shape (account_id was the primary
        // key, one character per account). No-op once an id column exists.
        await pool.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
               WHERE table_name = 'characters' AND column_name = 'id'
            ) THEN
              ALTER TABLE characters DROP CONSTRAINT characters_pkey;
              ALTER TABLE characters ADD COLUMN id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY;
            END IF;
          END
          $$
        `);
        await pool.query(
          "CREATE INDEX IF NOT EXISTS idx_characters_account ON characters (account_id)",
        );
        // Which character a member plays in a room (set when they enter it).
        await pool.query(
          "ALTER TABLE room_members ADD COLUMN IF NOT EXISTS character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL",
        );
        await pool.query(`
          CREATE TABLE IF NOT EXISTS notes (
            id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
            title VARCHAR(120) NOT NULL,
            body TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `);
        await pool.query(
          "CREATE INDEX IF NOT EXISTS idx_notes_character ON notes (character_id)",
        );      })().catch((error) => {
        schemaPromise = undefined;
        throw error;
      });
    }
    return schemaPromise;
  };
}

module.exports = { createPool, createSchemaInitializer };
