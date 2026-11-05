"use strict";

const {
  validateRoomName,
  validateRoomCode,
  validateMemberUsername,
  validateId,
} = require("../validation/validators");

// HTTP adapter for rooms. Validates input at the boundary, delegates all rules
// to RoomService, and forwards errors via next(error). No SQL, no business logic
// (architecture guide, backend rules 1, 3, 6).
class RoomController {
  constructor(roomService) {
    this.roomService = roomService;
  }

  // Unexpected failures in room endpoints read as a room-specific 503.
  setServiceErrorMessage(res) {
    res.locals.serviceErrorMessage =
      "Room service is temporarily unavailable.";
  }

  // Resolves the caller's account id from the session attached by middleware.
  accountId(req) {
    return this.roomService.requireAccountId(req.session.username);
  }

  list = async (req, res, next) => {
    this.setServiceErrorMessage(res);
    try {
      const accountId = await this.accountId(req);
      const rooms = await this.roomService.listForAccount(accountId);
      res.status(200).json({ rooms });
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    this.setServiceErrorMessage(res);
    try {
      const accountId = await this.accountId(req);
      const roomname = validateRoomName(req.body);
      const room = await this.roomService.createRoom(accountId, roomname);
      res.status(201).json({ room });
    } catch (error) {
      next(error);
    }
  };

  join = async (req, res, next) => {
    this.setServiceErrorMessage(res);
    try {
      const accountId = await this.accountId(req);
      const roomCode = validateRoomCode(req.body);
      const room = await this.roomService.joinRoom(accountId, roomCode);
      res.status(200).json({ room });
    } catch (error) {
      next(error);
    }
  };

  listMembers = async (req, res, next) => {
    this.setServiceErrorMessage(res);
    try {
      const accountId = await this.accountId(req);
      const roomId = validateId(req.params.roomId, "room id");
      const members = await this.roomService.listMembers(roomId, accountId);
      res.status(200).json({ members });
    } catch (error) {
      next(error);
    }
  };

  addMember = async (req, res, next) => {
    this.setServiceErrorMessage(res);
    try {
      const accountId = await this.accountId(req);
      const roomId = validateId(req.params.roomId, "room id");
      const username = validateMemberUsername(req.body);
      const members = await this.roomService.addMember(
        roomId,
        accountId,
        username,
      );
      res.status(200).json({ members });
    } catch (error) {
      next(error);
    }
  };

  removeMember = async (req, res, next) => {
    this.setServiceErrorMessage(res);
    try {
      const accountId = await this.accountId(req);
      const roomId = validateId(req.params.roomId, "room id");
      const memberId = validateId(req.params.memberId, "member id");
      const members = await this.roomService.removeMember(
        roomId,
        memberId,
        accountId,
      );
      res.status(200).json({ members });
    } catch (error) {
      next(error);
    }
  };

  remove = async (req, res, next) => {
    this.setServiceErrorMessage(res);
    try {
      const accountId = await this.accountId(req);
      const roomId = validateId(req.params.roomId, "room id");
      await this.roomService.deleteRoom(roomId, accountId);
      res.status(200).json({ deleted: true });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { RoomController };
