"use strict";

const path = require("node:path");
const express = require("express");
const bcrypt = require("bcryptjs");

const { createSchemaInitializer } = require("./config/database");
const { AccountRepository } = require("./repositories/AccountRepository");
const { RoomRepository } = require("./repositories/RoomRepository");
const { MemberRepository } = require("./repositories/MemberRepository");
const { SessionStore } = require("./services/SessionStore");
const { AuthService } = require("./services/AuthService");
const { RoomService } = require("./services/RoomService");
const { AuthController } = require("./controllers/AuthController");
const { RoomController } = require("./controllers/RoomController");
const {
  createAuthMiddleware,
  createSchemaMiddleware,
} = require("./middleware/authMiddleware");
const { errorHandler } = require("./middleware/errorHandler");
const { createStaticHandler } = require("./middleware/staticFiles");
const { createAuthRouter } = require("./routes/authRoutes");
const { createRoomRouter } = require("./routes/roomRoutes");

// Composition root (architecture guide, backend rule 2). This is the single
// place where dependencies are instantiated and wired together. Handlers and
// controllers never call `new Service()`; collaborators are injected here.
//
// The pool is injected so tests can supply their own (or a mock). Returns the
// configured Express app and the schema initializer used at startup.
function createApp({ pool, config, logger = console }) {
  const ensureSchema = createSchemaInitializer(pool);

  // Repositories (SQL layer) — one pool, shared.
  const accountRepo = new AccountRepository(pool);
  const roomRepo = new RoomRepository(pool);
  const memberRepo = new MemberRepository(pool);

  // Services (domain layer) — no HTTP, no SQL.
  const sessionStore = new SessionStore({ durationMs: config.sessionDurationMs });
  const crypto = {
    hash: (value, rounds) => bcrypt.hash(value, rounds),
    compare: (value, hash) => bcrypt.compare(value, hash),
  };
  const authService = new AuthService(accountRepo, crypto, sessionStore);
  const roomService = new RoomService(roomRepo, memberRepo, accountRepo);

  // Controllers (HTTP adapters).
  const authController = new AuthController(authService, {
    cookieName: config.sessionCookieName,
    sessionDurationMs: config.sessionDurationMs,
  });
  const roomController = new RoomController(roomService);

  // Middleware.
  const { attachSession, requireSession } = createAuthMiddleware(
    authService,
    config.sessionCookieName,
  );
  const schemaMiddleware = createSchemaMiddleware(ensureSchema);

  const app = express();
  app.use(express.json({ limit: "10kb" }));

  // Health check.
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // API routers.
  app.use(
    "/api/auth",
    createAuthRouter({ authController, schemaMiddleware, attachSession }),
  );
  app.use(
    "/api/rooms",
    createRoomRouter({ roomController, schemaMiddleware, requireSession }),
  );

  // Static frontend (SPA fallback). Lives after the API routes. Serves the
  // Vite build output (frontend/dist); run `npm run build` to generate it.
  const frontendDirectory = path.join(__dirname, "..", "frontend", "dist");
  app.use(createStaticHandler(frontendDirectory));

  // Single global error middleware — maps typed errors to HTTP responses.
  app.use(errorHandler(logger));

  return { app, ensureSchema };
}

module.exports = { createApp };
