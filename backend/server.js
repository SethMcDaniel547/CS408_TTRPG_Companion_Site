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
    schemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        username VARCHAR(32) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(255)
      )
    `).catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
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
  return false;
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (await handleApi(request, response, requestUrl.pathname)) return;

  const appRoutes = new Set(["/", "/signin", "/signup", "/account"]);
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
