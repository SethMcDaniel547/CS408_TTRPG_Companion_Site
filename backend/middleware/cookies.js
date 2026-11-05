"use strict";

// HTTP cookie helpers for the session cookie. These are an HTTP concern, used by
// the auth middleware and controller — not by services.

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .filter(Boolean)
      .map((part) => {
        const [name, ...value] = part.trim().split("=");
        return [name, decodeURIComponent(value.join("="))];
      }),
  );
}

function requestUsesHttps(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol =
    typeof forwardedProto === "string"
      ? forwardedProto.split(",")[0].trim().toLowerCase()
      : "";
  return protocol === "https" || Boolean(req.socket.encrypted);
}

function sessionCookie(cookieName, token, durationMs, req) {
  const secure = requestUsesHttps(req) ? "; Secure" : "";
  return `${cookieName}=${encodeURIComponent(token)}; Max-Age=${durationMs / 1000}; HttpOnly; SameSite=Lax; Path=/${secure}`;
}

function clearSessionCookie(cookieName, req) {
  const secure = requestUsesHttps(req) ? "; Secure" : "";
  return `${cookieName}=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/${secure}`;
}

module.exports = {
  parseCookies,
  requestUsesHttps,
  sessionCookie,
  clearSessionCookie,
};
