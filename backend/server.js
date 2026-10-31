const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const port = Number.parseInt(process.env.PORT || "3000", 10);
const host = process.env.HOST || "127.0.0.1";
const frontendDirectory = path.join(__dirname, "..", "frontend");
const sessionDurationMs = 8 * 60 * 60 * 1000;
const sessionCookieName = "ttrpg_session";
const sessions = new Map();
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.DATABASE_URL ? undefined : process.env.DB_HOST,
  port: process.env.DATABASE_URL ? undefined : process.env.DB_PORT
    ? Number.parseInt(process.env.DB_PORT, 10)
    : undefined,
  database: process.env.DATABASE_URL ? undefined : process.env.DB_NAME,
  user: process.env.DATABASE_URL ? undefined : process.env.DB_USER,
  password: process.env.DATABASE_URL ? undefined : process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
});

let schemaPromise;
function ensureSchema() {
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
}

const roomCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateRoomCode() {
  const bytes = crypto.randomBytes(8);
  let code = "";
  for (let index = 0; index < 8; index += 1) {
    code += roomCodeAlphabet[bytes[index] % roomCodeAlphabet.length];
  }
  return code;
}

async function createUniqueRoomCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateRoomCode();
    const existing = await pool.query(
      "SELECT 1 FROM game_rooms WHERE room_code = $1",
      [code],
    );
    if (existing.rowCount === 0) return code;
  }
  throw new Error("Unable to generate a unique room code");
}

async function accountIdForUsername(username) {
  const result = await pool.query(
    "SELECT id FROM accounts WHERE username = $1",
    [username],
  );
  return result.rows[0]?.id ?? null;
}

function sendJson(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10_000) {
        reject(new Error("Request body is too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Request body must be valid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function parseCookies(request) {
  return Object.fromEntries(
    (request.headers.cookie || "").split(";").filter(Boolean).map((part) => {
      const [name, ...value] = part.trim().split("=");
      return [name, decodeURIComponent(value.join("="))];
    }),
  );
}

function createSession(username) {
  const token = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, { username, expiresAt: Date.now() + sessionDurationMs });
  return token;
}

function requestUsesHttps(request) {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol = typeof forwardedProto === "string"
    ? forwardedProto.split(",")[0].trim().toLowerCase()
    : "";
  return protocol === "https" || Boolean(request.socket.encrypted);
}

function sessionCookie(token, request) {
  const secure = requestUsesHttps(request) ? "; Secure" : "";
  return `${sessionCookieName}=${encodeURIComponent(token)}; Max-Age=${sessionDurationMs / 1000}; HttpOnly; SameSite=Lax; Path=/${secure}`;
}

function clearSessionCookie(request) {
  const secure = requestUsesHttps(request) ? "; Secure" : "";
  return `${sessionCookieName}=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/${secure}`;
}

function currentSession(request) {
  const token = parseCookies(request)[sessionCookieName];
  const session = token && sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  return { token, ...session };
}

async function handleAuth(request, response, pathname) {
  try {
    await ensureSchema();
    const input = await readJson(request);
    const username = typeof input.username === "string" ? input.username.trim() : "";
    const password = typeof input.password === "string" ? input.password : "";
    const email = typeof input.email === "string" && input.email.trim()
      ? input.email.trim()
      : null;

    if (!/^[A-Za-z0-9_]{3,32}$/.test(username) || password.length < 8 || password.length > 128) {
      sendJson(response, 400, {
        error: "Username must be 3-32 letters, numbers, or underscores, and password must be 8-128 characters.",
      });
      return;
    }

    if (pathname === "/api/auth/signup") {
      const passwordHash = await bcrypt.hash(password, 12);
      try {
        await pool.query(
          "INSERT INTO accounts (username, password_hash, email) VALUES ($1, $2, $3)",
          [username, passwordHash, email],
        );
      } catch (error) {
        if (error.code === "23505") {
          sendJson(response, 409, { error: "That username is already in use." });
          return;
        }
        throw error;
      }
    } else {
      const result = await pool.query(
        "SELECT username, password_hash FROM accounts WHERE username = $1",
        [username],
      );
      const account = result.rows[0];
      if (!account || !(await bcrypt.compare(password, account.password_hash))) {
        sendJson(response, 401, { error: "Invalid username or password." });
        return;
      }
    }

    const token = createSession(username);
    sendJson(response, 200, { username }, { "Set-Cookie": sessionCookie(token, request) });
  } catch (error) {
    console.error("Authentication request failed:", error.message);
    sendJson(response, 503, { error: "Authentication service is temporarily unavailable." });
  }
}

function roomView(row, accountId) {
  return {
    id: row.id,
    roomname: row.roomname,
    roomCode: row.room_code.trim(),
    isGm: row.gm === accountId,
    playerCount: Number.parseInt(row.player_count, 10) || 0,
  };
}

async function listRoomsForAccount(response, accountId) {
  const result = await pool.query(
    `SELECT r.id, r.roomname, r.room_code, r.gm,
            (SELECT COUNT(*) FROM room_members m WHERE m.room_id = r.id) AS player_count
       FROM game_rooms r
      WHERE r.gm = $1
         OR EXISTS (SELECT 1 FROM room_members m WHERE m.room_id = r.id AND m.account_id = $1)
      ORDER BY r.roomname ASC`,
    [accountId],
  );
  sendJson(response, 200, { rooms: result.rows.map((row) => roomView(row, accountId)) });
}

async function createRoom(request, response, accountId) {
  const input = await readJson(request);
  const roomname = typeof input.roomname === "string" ? input.roomname.trim() : "";
  if (roomname.length < 1 || roomname.length > 64) {
    sendJson(response, 400, { error: "Room name must be 1-64 characters." });
    return;
  }
  const roomCode = await createUniqueRoomCode();
  const result = await pool.query(
    "INSERT INTO game_rooms (roomname, gm, room_code) VALUES ($1, $2, $3) RETURNING id, roomname, room_code, gm",
    [roomname, accountId, roomCode],
  );
  const row = { ...result.rows[0], player_count: 0 };
  sendJson(response, 201, { room: roomView(row, accountId) });
}

async function joinRoom(request, response, accountId) {
  const input = await readJson(request);
  const rawCode = typeof input.roomCode === "string" ? input.roomCode.trim().toUpperCase() : "";
  if (!/^[A-Z0-9]{8}$/.test(rawCode)) {
    sendJson(response, 400, { error: "Room codes are 8 characters." });
    return;
  }
  const roomResult = await pool.query(
    "SELECT id, roomname, room_code, gm FROM game_rooms WHERE room_code = $1",
    [rawCode],
  );
  const room = roomResult.rows[0];
  if (!room) {
    sendJson(response, 404, { error: "No room matches that code." });
    return;
  }
  if (room.gm !== accountId) {
    await pool.query(
      "INSERT INTO room_members (room_id, account_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [room.id, accountId],
    );
  }
  const countResult = await pool.query(
    "SELECT COUNT(*) AS player_count FROM room_members WHERE room_id = $1",
    [room.id],
  );
  const row = { ...room, player_count: countResult.rows[0].player_count };
  sendJson(response, 200, { room: roomView(row, accountId) });
}

async function assertRoomOwnership(roomId, accountId) {
  const result = await pool.query(
    "SELECT id, gm FROM game_rooms WHERE id = $1",
    [roomId],
  );
  const room = result.rows[0];
  if (!room) return { error: 404 };
  if (room.gm !== accountId) return { error: 403 };
  return { room };
}

async function listMembers(response, roomId, accountId) {
  const ownership = await assertRoomOwnership(roomId, accountId);
  if (ownership.error) {
    sendJson(response, ownership.error, { error: ownership.error === 404 ? "Room not found." : "Only the GM can manage this room." });
    return;
  }
  const result = await pool.query(
    `SELECT a.id, a.username
       FROM room_members m
       JOIN accounts a ON a.id = m.account_id
      WHERE m.room_id = $1
      ORDER BY a.username ASC`,
    [roomId],
  );
  sendJson(response, 200, { members: result.rows });
}

async function addMember(request, response, roomId, accountId) {
  const ownership = await assertRoomOwnership(roomId, accountId);
  if (ownership.error) {
    sendJson(response, ownership.error, { error: ownership.error === 404 ? "Room not found." : "Only the GM can manage this room." });
    return;
  }
  const input = await readJson(request);
  const username = typeof input.username === "string" ? input.username.trim() : "";
  if (!/^[A-Za-z0-9_]{3,32}$/.test(username)) {
    sendJson(response, 400, { error: "Provide a valid username to add." });
    return;
  }
  const memberId = await accountIdForUsername(username);
  if (!memberId) {
    sendJson(response, 404, { error: "No account with that username." });
    return;
  }
  if (memberId === accountId) {
    sendJson(response, 400, { error: "The GM is already in the room." });
    return;
  }
  await pool.query(
    "INSERT INTO room_members (room_id, account_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [roomId, memberId],
  );
  await listMembers(response, roomId, accountId);
}

async function removeMember(response, roomId, memberId, accountId) {
  const ownership = await assertRoomOwnership(roomId, accountId);
  if (ownership.error) {
    sendJson(response, ownership.error, { error: ownership.error === 404 ? "Room not found." : "Only the GM can manage this room." });
    return;
  }
  await pool.query(
    "DELETE FROM room_members WHERE room_id = $1 AND account_id = $2",
    [roomId, memberId],
  );
  await listMembers(response, roomId, accountId);
}

async function deleteRoom(response, roomId, accountId) {
  const ownership = await assertRoomOwnership(roomId, accountId);
  if (ownership.error) {
    sendJson(response, ownership.error, { error: ownership.error === 404 ? "Room not found." : "Only the GM can delete this room." });
    return;
  }
  await pool.query("DELETE FROM game_rooms WHERE id = $1", [roomId]);
  sendJson(response, 200, { deleted: true });
}

async function handleRooms(request, response, pathname) {
  const session = currentSession(request);
  if (!session) {
    sendJson(response, 401, { error: "You must be signed in." });
    return true;
  }
  let accountId;
  try {
    await ensureSchema();
    accountId = await accountIdForUsername(session.username);
    if (!accountId) {
      sendJson(response, 401, { error: "Your account could not be found." });
      return true;
    }

    if (pathname === "/api/rooms" && request.method === "GET") {
      await listRoomsForAccount(response, accountId);
      return true;
    }
    if (pathname === "/api/rooms" && request.method === "POST") {
      await createRoom(request, response, accountId);
      return true;
    }
    if (pathname === "/api/rooms/join" && request.method === "POST") {
      await joinRoom(request, response, accountId);
      return true;
    }

    const membersMatch = pathname.match(/^\/api\/rooms\/(\d+)\/members$/);
    if (membersMatch) {
      const roomId = Number.parseInt(membersMatch[1], 10);
      if (request.method === "GET") {
        await listMembers(response, roomId, accountId);
        return true;
      }
      if (request.method === "POST") {
        await addMember(request, response, roomId, accountId);
        return true;
      }
    }

    const memberMatch = pathname.match(/^\/api\/rooms\/(\d+)\/members\/(\d+)$/);
    if (memberMatch && request.method === "DELETE") {
      await removeMember(response, Number.parseInt(memberMatch[1], 10), Number.parseInt(memberMatch[2], 10), accountId);
      return true;
    }

    const roomMatch = pathname.match(/^\/api\/rooms\/(\d+)$/);
    if (roomMatch && request.method === "DELETE") {
      await deleteRoom(response, Number.parseInt(roomMatch[1], 10), accountId);
      return true;
    }

    return false;
  } catch (error) {
    if (error.message === "Request body must be valid JSON" || error.message === "Request body is too large") {
      sendJson(response, 400, { error: error.message });
      return true;
    }
    console.error("Room request failed:", error.message);
    sendJson(response, 503, { error: "Room service is temporarily unavailable." });
    return true;
  }
}

async function handleApi(request, response, pathname) {
  if (pathname === "/api/health" && request.method === "GET") {
    sendJson(response, 200, { status: "ok" });
    return true;
  }
  if ((pathname === "/api/auth/signup" || pathname === "/api/auth/signin")
      && request.method === "POST") {
    await handleAuth(request, response, pathname);
    return true;
  }
  if (pathname === "/api/auth/me" && request.method === "GET") {
    const session = currentSession(request);
    sendJson(response, 200, { authenticated: Boolean(session), username: session?.username || null });
    return true;
  }
  if (pathname === "/api/auth/signout" && request.method === "POST") {
    const session = currentSession(request);
    if (session) sessions.delete(session.token);
    sendJson(response, 200, { authenticated: false }, { "Set-Cookie": clearSessionCookie(request) });
    return true;
  }
  if (pathname.startsWith("/api/rooms")) {
    return handleRooms(request, response, pathname);
  }
  return false;
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (await handleApi(request, response, requestUrl.pathname)) return;

  const appRoutes = new Set(["/", "/signin", "/signup", "/account", "/character", "/room", "/room-settings", "/notes"]);
  const relativePath = appRoutes.has(requestUrl.pathname) ? "/index.html" : requestUrl.pathname;
  const filePath = path.resolve(frontendDirectory, `.${relativePath}`);
  if (!filePath.startsWith(`${frontendDirectory}${path.sep}`)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found\n");
    return;
  }

  fs.readFile(filePath, (error, file) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found\n");
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
    });
    response.end(file);
  });
});

server.listen(port, host, () => {
  console.log(`TTRPG Companion listening on ${host}:${port}`);
  ensureSchema().catch((error) => {
    console.error("Database initialization failed:", error.message);
  });
});

function shutdown() {
  server.close(() => pool.end().finally(() => process.exit(0)));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
