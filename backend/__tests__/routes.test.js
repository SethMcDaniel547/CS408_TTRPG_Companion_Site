"use strict";

// HTTP route tests with supertest (architecture testing rule 3). These assert
// status codes and response shapes across the full stack (routes → controller →
// service → repository), using a fake pg pool so no real database is needed.
//
// Repository integration against a real Postgres (testing rule 2) is a separate
// concern; see the note in the task summary. These tests deliberately stub the
// pool at the edge so the layering and HTTP contract are exercised in CI without
// a database container.
const request = require("supertest");
const { createApp } = require("../app");
const { loadConfig } = require("../config/env");

// A programmable fake pool. Each test installs a query handler that inspects the
// SQL text and returns canned rows, mimicking pg's { rows, rowCount } shape.
function makeFakePool(handler) {
  return {
    query: (text, params) => Promise.resolve(handler(text, params)),
  };
}

const config = loadConfig({ PORT: "3000", HOST: "127.0.0.1" });
const silentLogger = { error: () => {}, log: () => {} };

function buildApp(handler) {
  const pool = makeFakePool(handler);
  const { app } = createApp({ pool, config, logger: silentLogger });
  return app;
}

// Schema creation issues CREATE TABLE/INDEX statements; treat them as no-ops.
function isSchema(text) {
  return /CREATE TABLE|CREATE (UNIQUE )?INDEX/i.test(text);
}

describe("GET /api/health", () => {
  it("returns 200 and status ok", async () => {
    const app = buildApp(() => ({ rows: [], rowCount: 0 }));
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("GET /api/auth/me", () => {
  it("reports an unauthenticated visitor", async () => {
    const app = buildApp(() => ({ rows: [], rowCount: 0 }));
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ authenticated: false, username: null });
  });
});

describe("POST /api/auth/signup", () => {
  it("rejects invalid input at the controller boundary with 400", async () => {
    const app = buildApp((text) => {
      if (isSchema(text)) return { rows: [], rowCount: 0 };
      throw new Error("no query should run for invalid input");
    });
    const res = await request(app).post("/api/auth/signup").send({ username: "ab", password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Username must be/);
  });

  it("creates an account and sets a session cookie", async () => {
    const app = buildApp((text) => {
      if (isSchema(text)) return { rows: [], rowCount: 0 };
      if (/INSERT INTO accounts/i.test(text)) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ username: "alice", password: "supersecret" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ username: "alice" });
    expect(res.headers["set-cookie"][0]).toMatch(/ttrpg_session=/);
  });

  it("maps a duplicate username to 409", async () => {
    const app = buildApp((text) => {
      if (isSchema(text)) return { rows: [], rowCount: 0 };
      if (/INSERT INTO accounts/i.test(text)) {
        return Promise.reject(Object.assign(new Error("dup"), { code: "23505" }));
      }
      return { rows: [], rowCount: 0 };
    });
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ username: "alice", password: "supersecret" });
    expect(res.status).toBe(409);
  });
});

describe("rooms require authentication", () => {
  it("returns 401 without a session", async () => {
    const app = buildApp((text) => (isSchema(text) ? { rows: [], rowCount: 0 } : { rows: [], rowCount: 0 }));
    const res = await request(app).get("/api/rooms");
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/signed in/);
  });
});

describe("character endpoints", () => {
  const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("data")]);

  async function agentWith(extra) {
    const app = buildApp((text, params) => {
      if (isSchema(text)) return { rows: [], rowCount: 0 };
      if (/INSERT INTO accounts/i.test(text)) return { rows: [], rowCount: 1 };
      if (/SELECT id FROM accounts WHERE username/i.test(text)) return { rows: [{ id: 1 }], rowCount: 1 };
      return extra ? extra(text, params) : { rows: [], rowCount: 0 };
    });
    const agent = request.agent(app);
    await agent.post("/api/auth/signup").send({ username: "alice", password: "supersecret" });
    return agent;
  }

  it("requires a session", async () => {
    const app = buildApp(() => ({ rows: [], rowCount: 0 }));
    expect((await request(app).get("/api/character")).status).toBe(401);
  });

  it("returns an empty character by default", async () => {
    const agent = await agentWith();
    const res = await agent.get("/api/character");
    expect(res.status).toBe(200);
    expect(res.body.character).toEqual({ name: "", info: "", hasToken: false, tokenUrl: null });
  });

  it("rejects an empty character name with 400", async () => {
    const agent = await agentWith();
    const res = await agent.put("/api/character").send({ name: "  ", info: "" });
    expect(res.status).toBe(400);
  });

  it("saves a character", async () => {
    const agent = await agentWith((text) =>
      /INSERT INTO characters/i.test(text)
        ? { rows: [{ name: "Nyx", info: "bio", has_token: false, updated_at: new Date() }], rowCount: 1 }
        : { rows: [], rowCount: 0 },
    );
    const res = await agent.put("/api/character").send({ name: "Nyx", info: "bio" });
    expect(res.status).toBe(200);
    expect(res.body.character.name).toBe("Nyx");
  });

  it("rejects a non-image token upload with 400", async () => {
    const agent = await agentWith();
    const res = await agent
      .put("/api/character/token")
      .set("Content-Type", "image/png")
      .send(Buffer.from("not an image"));
    expect(res.status).toBe(400);
  });

  it("accepts a PNG token upload", async () => {
    const agent = await agentWith((text) =>
      /INSERT INTO characters/i.test(text)
        ? { rows: [{ name: "", info: "", has_token: true, updated_at: new Date(1) }], rowCount: 1 }
        : { rows: [], rowCount: 0 },
    );
    const res = await agent.put("/api/character/token").set("Content-Type", "image/png").send(PNG);
    expect(res.status).toBe(200);
    expect(res.body.character.tokenUrl).toBe("/api/character/token?v=1");
  });

  it("serves the stored token and 404s when absent", async () => {
    const withToken = await agentWith((text) =>
      /SELECT token_data/i.test(text)
        ? { rows: [{ token_data: PNG, token_type: "image/png" }], rowCount: 1 }
        : { rows: [], rowCount: 0 },
    );
    const ok = await withToken.get("/api/character/token");
    expect(ok.status).toBe(200);
    expect(ok.headers["content-type"]).toMatch(/image\/png/);

    const without = await agentWith();
    expect((await without.get("/api/character/token")).status).toBe(404);
  });
});

describe("authenticated room flow", () => {
  // Signs up to obtain a session cookie, then reuses it for a room request.
  async function signedInAgent(handler) {
    const app = buildApp(handler);
    const agent = request.agent(app);
    const signup = await agent
      .post("/api/auth/signup")
      .send({ username: "alice", password: "supersecret" });
    expect(signup.status).toBe(200);
    return agent;
  }

  it("lists rooms for the signed-in account", async () => {
    const agent = await signedInAgent((text) => {
      if (isSchema(text)) return { rows: [], rowCount: 0 };
      if (/INSERT INTO accounts/i.test(text)) return { rows: [], rowCount: 1 };
      if (/SELECT id FROM accounts WHERE username/i.test(text)) return { rows: [{ id: 1 }], rowCount: 1 };
      if (/FROM game_rooms r/i.test(text)) {
        return {
          rows: [{ id: 10, roomname: "Mine", room_code: "ABCD2345", gm: 1, player_count: "2" }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await agent.get("/api/rooms");
    expect(res.status).toBe(200);
    expect(res.body.rooms).toEqual([
      { id: 10, roomname: "Mine", roomCode: "ABCD2345", isGm: true, playerCount: 2 },
    ]);
  });

  it("returns 400 for a malformed room code on join (failure path)", async () => {
    const agent = await signedInAgent((text) => {
      if (isSchema(text)) return { rows: [], rowCount: 0 };
      if (/INSERT INTO accounts/i.test(text)) return { rows: [], rowCount: 1 };
      if (/SELECT id FROM accounts WHERE username/i.test(text)) return { rows: [{ id: 1 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });

    const res = await agent.post("/api/rooms/join").send({ roomCode: "nope" });
    expect(res.status).toBe(400);
  });
});
