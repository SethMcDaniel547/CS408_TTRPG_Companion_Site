"use strict";

const crypto = require("node:crypto");

// In-memory session store. This is a domain collaborator (no HTTP, no SQL);
// controllers translate between it and cookies. The single-process limitation
// is tracked in documentation/futureSecurityFixes.md.
class SessionStore {
  constructor({ durationMs }) {
    this.durationMs = durationMs;
    this.sessions = new Map();
  }

  create(username) {
    const token = crypto.randomBytes(32).toString("base64url");
    this.sessions.set(token, {
      username,
      expiresAt: Date.now() + this.durationMs,
    });
    return token;
  }

  // Returns { token, username, expiresAt } for a live session, or null.
  get(token) {
    const session = token && this.sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
      if (token) this.sessions.delete(token);
      return null;
    }
    return { token, ...session };
  }

  destroy(token) {
    if (token) this.sessions.delete(token);
  }
}

module.exports = { SessionStore };
