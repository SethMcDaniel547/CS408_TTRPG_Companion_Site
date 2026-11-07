"use strict";

const { AppError } = require("../errors/AppError");

// Input validation used at the controller boundary (architecture guide, backend
// rule 3). Controllers validate raw req.body here and pass only clean, typed
// values into services. Invalid input is rejected with a 400 before it reaches
// any domain logic.

function asString(value) {
  return typeof value === "string" ? value : "";
}

function validateCredentials(body) {
  const username = asString(body.username).trim();
  const password = asString(body.password);
  const email = asString(body.email).trim() || null;

  if (
    !/^[A-Za-z0-9_]{3,32}$/.test(username) ||
    password.length < 8 ||
    password.length > 128
  ) {
    throw new AppError(
      "Username must be 3-32 letters, numbers, or underscores, and password must be 8-128 characters.",
      400,
    );
  }
  return { username, password, email };
}

function validateRoomName(body) {
  const roomname = asString(body.roomname).trim();
  if (roomname.length < 1 || roomname.length > 64) {
    throw new AppError("Room name must be 1-64 characters.", 400);
  }
  return roomname;
}

function validateRoomCode(body) {
  const roomCode = asString(body.roomCode).trim().toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(roomCode)) {
    throw new AppError("Room codes are 8 characters.", 400);
  }
  return roomCode;
}

function validateMemberUsername(body) {
  const username = asString(body.username).trim();
  if (!/^[A-Za-z0-9_]{3,32}$/.test(username)) {
    throw new AppError("Provide a valid username to add.", 400);
  }
  return username;
}

function validateId(raw, label = "id") {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id < 1) {
    throw new AppError(`Invalid ${label}.`, 400);
  }
  return id;
}

function validateCharacter(body) {
  const name = asString(body.name).trim();
  const info = asString(body.info);
  if (name.length < 1 || name.length > 80) {
    throw new AppError("Character name must be 1-80 characters.", 400);
  }
  if (info.length > 10000) {
    throw new AppError("Character information must be 10000 characters or fewer.", 400);
  }
  return { name, info };
}

const TOKEN_MAX_BYTES = 2 * 1024 * 1024;

// Detects the real image type from magic bytes rather than trusting the
// client-supplied Content-Type header.
function detectImageType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("latin1"))) {
    return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("latin1") === "RIFF" &&
    buffer.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function validateTokenImage(body) {
  if (!Buffer.isBuffer(body) || body.length === 0) {
    throw new AppError("Upload a PNG, JPEG, GIF, or WebP image.", 400);
  }
  if (body.length > TOKEN_MAX_BYTES) {
    throw new AppError("Token images must be 2 MB or smaller.", 400);
  }
  const contentType = detectImageType(body);
  if (!contentType) {
    throw new AppError("Token must be a PNG, JPEG, GIF, or WebP image.", 400);
  }
  return { data: body, contentType };
}

module.exports = {
  TOKEN_MAX_BYTES,
  validateCharacter,
  validateTokenImage,
  validateCredentials,
  validateRoomName,
  validateRoomCode,
  validateMemberUsername,
  validateId,
};
