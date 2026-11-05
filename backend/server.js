"use strict";

// Entry point. Reads config, creates the shared pool, builds the app via the
// composition root, and starts listening. Kept thin on purpose: no routing,
// no business logic, no SQL. systemd and start.sh both launch this file.

const { loadConfig } = require("./config/env");
const { createPool } = require("./config/database");
const { createApp } = require("./app");

const config = loadConfig();
const pool = createPool(config);
const { app, ensureSchema } = createApp({ pool, config });

const server = app.listen(config.port, config.host, () => {
  console.log(`TTRPG Companion listening on ${config.host}:${config.port}`);
  ensureSchema().catch((error) => {
    console.error("Database initialization failed:", error.message);
  });
});

function shutdown() {
  server.close(() => pool.end().finally(() => process.exit(0)));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

module.exports = { app, server };
