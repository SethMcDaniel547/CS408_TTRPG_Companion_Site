"use strict";

const { validateCredentials } = require("../validation/validators");
const { sessionCookie, clearSessionCookie } = require("../middleware/cookies");

// HTTP adapter for authentication. Translates req/res to/from plain values,
// validates input at the boundary, and forwards errors via next(error). No SQL,
// no business rules (architecture guide, backend rules 1, 3, 6).
class AuthController {
  constructor(authService, { cookieName, sessionDurationMs }) {
    this.authService = authService;
    this.cookieName = cookieName;
    this.sessionDurationMs = sessionDurationMs;
  }

  // Unexpected failures in auth should read as an auth-specific 503.
  setServiceErrorMessage(res) {
    res.locals.serviceErrorMessage =
      "Authentication service is temporarily unavailable.";
  }

  issueSession(req, res, status, username, token) {
    res.setHeader(
      "Set-Cookie",
      sessionCookie(this.cookieName, token, this.sessionDurationMs, req),
    );
    res.status(status).json({ username });
  }

  signup = async (req, res, next) => {
    this.setServiceErrorMessage(res);
    try {
      const credentials = validateCredentials(req.body);
      const { username, token } = await this.authService.signup(credentials);
      this.issueSession(req, res, 200, username, token);
    } catch (error) {
      next(error);
    }
  };

  signin = async (req, res, next) => {
    this.setServiceErrorMessage(res);
    try {
      const { username, password } = validateCredentials(req.body);
      const result = await this.authService.signin({ username, password });
      this.issueSession(req, res, 200, result.username, result.token);
    } catch (error) {
      next(error);
    }
  };

  me = (req, res) => {
    const session = req.session;
    res.status(200).json({
      authenticated: Boolean(session),
      username: session?.username || null,
    });
  };

  signout = (req, res) => {
    if (req.session) this.authService.signout(req.session.token);
    res.setHeader("Set-Cookie", clearSessionCookie(this.cookieName, req));
    res.status(200).json({ authenticated: false });
  };
}

module.exports = { AuthController };
