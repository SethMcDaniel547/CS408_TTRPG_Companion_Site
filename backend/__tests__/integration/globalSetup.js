"use strict";

const { createTestPool, TEST_DATABASE_URL } = require("./testDatabase");
const { createSchemaInitializer } = require("../../config/database");

// Runs once before the integration suite. Connects to the test database (with a
// short retry loop in case the container is still accepting connections) and
// creates the schema using the exact same initializer the app uses in
// production, so the integration tests exercise the real tables, not a copy.
module.exports = async function globalSetup() {
  const pool = createTestPool();

  let lastError;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await pool.query("SELECT 1");
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  if (lastError) {
    await pool.end();
    throw new Error(
      `Could not connect to the test database at ${TEST_DATABASE_URL}. ` +
        "Start it first with `npm run db:test:up`. Original error: " +
        lastError.message,
    );
  }

  const ensureSchema = createSchemaInitializer(pool);
  await ensureSchema();
  await pool.end();
};
