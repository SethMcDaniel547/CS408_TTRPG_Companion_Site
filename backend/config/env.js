"use strict";

// Centralized environment configuration. Secrets and connection settings come
// from environment variables only (architecture guide, backend rule 8); nothing
// is hard-coded here.

function parsePort(value) {
  const port = Number.parseInt(value || "3000", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return port;
}

function loadConfig(env = process.env) {
  return {
    host: env.HOST || "127.0.0.1",
    port: parsePort(env.PORT),
    sessionDurationMs: 8 * 60 * 60 * 1000,
    sessionCookieName: "ttrpg_session",
    database: {
      connectionString: env.DATABASE_URL || undefined,
      host: env.DATABASE_URL ? undefined : env.DB_HOST,
      port: env.DATABASE_URL
        ? undefined
        : env.DB_PORT
          ? Number.parseInt(env.DB_PORT, 10)
          : undefined,
      database: env.DATABASE_URL ? undefined : env.DB_NAME,
      user: env.DATABASE_URL ? undefined : env.DB_USER,
      password: env.DATABASE_URL ? undefined : env.DB_PASSWORD,
      ssl: env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    },
  };
}

module.exports = { loadConfig, parsePort };
