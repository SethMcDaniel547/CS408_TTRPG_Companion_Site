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

module.exports = {
  validateCredentials,
  validateRoomName,
  validateRoomCode,
  validateMemberUsername,
  validateId,
};
