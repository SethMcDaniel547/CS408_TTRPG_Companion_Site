"use strict";

// In-memory record of which accounts currently have a live connection in which
// room. A player can have several tabs open, so connections are counted.
// Single-process only; a multi-instance deploy would need a shared store.
class PresenceTracker {
  constructor() {
    this.rooms = new Map(); // roomId -> Map(accountId -> connection count)
  }

  // Returns true when this connection made the account newly present.
  connect(roomId, accountId) {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new Map();
      this.rooms.set(roomId, room);
    }
    const count = room.get(accountId) || 0;
    room.set(accountId, count + 1);
    return count === 0;
  }

  // Returns true when this was the account's last connection in the room.
  disconnect(roomId, accountId) {
    const room = this.rooms.get(roomId);
    const count = room?.get(accountId) || 0;
    if (count === 0) return false;
    if (count > 1) {
      room.set(accountId, count - 1);
      return false;
    }
    room.delete(accountId);
    if (room.size === 0) this.rooms.delete(roomId);
    return true;
  }

  isPresent(roomId, accountId) {
    return (this.rooms.get(roomId)?.get(accountId) || 0) > 0;
  }
}

module.exports = { PresenceTracker };
