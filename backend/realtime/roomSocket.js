"use strict";

const { Server } = require("socket.io");
const { parseCookies } = require("../middleware/cookies");
const { validateStatusUpdate, validateNotePass } = require("../validation/validators");

const channel = (roomId) => `room:${roomId}`;
const accountChannel = (roomId, accountId) => `room:${roomId}:account:${accountId}`;

// Socket.IO adapter for live room updates. Like a controller it only
// authenticates, validates, and delegates to services; rules live in
// RoomService. Events:
//   client -> server  "room:join"    { roomId }                      (ack)
//                     "status:update" { roomId, statusText, grayedOut } (ack)
//                     "note:pass"     { roomId, toAccountId, text }   (ack)
//   server -> client  "note:received" { text }  (recipient only)
//                     "player:update" { accountId, present?, statusText?, grayedOut? }
function attachRoomSocket(httpServer, { authService, roomService, presence, cookieName, logger = console }) {
  const io = new Server(httpServer, { serveClient: false });

  // Resolve the session cookie to an account id once per connection.
  io.use(async (socket, next) => {
    try {
      const session = authService.session(parseCookies(socket.request)[cookieName]);
      if (!session) return next(new Error("You must be signed in."));
      socket.data.accountId = await roomService.requireAccountId(session.username);
      next();
    } catch (error) {
      next(new Error(error.message || "Unable to authenticate."));
    }
  });

  io.on("connection", (socket) => {
    const { accountId } = socket.data;
    let joinedRoomId = null;
    let isPlayer = false;

    function leave() {
      if (joinedRoomId === null) return;
      const roomId = joinedRoomId;
      joinedRoomId = null;
      socket.leave(channel(roomId));
      socket.leave(accountChannel(roomId, accountId));
      if (isPlayer && presence.disconnect(roomId, accountId)) {
        io.to(channel(roomId)).emit("player:update", { accountId, present: false });
      }
    }

    async function handle(ack, work) {
      try {
        await work();
        ack?.({ ok: true });
      } catch (error) {
        if (!error.statusCode) logger.error?.("Socket error:", error.message);
        ack?.({ ok: false, error: error.statusCode ? error.message : "Request failed." });
      }
    }

    socket.on("room:join", (payload, ack) =>
      handle(ack, async () => {
        const roomId = Number.parseInt(payload?.roomId, 10);
        if (!Number.isInteger(roomId) || roomId < 1) throw Object.assign(new Error("Invalid room id."), { statusCode: 400 });
        const access = await roomService.getAccess(roomId, accountId);
        leave();
        joinedRoomId = roomId;
        isPlayer = !access.isGm;
        socket.join(channel(roomId));
        socket.join(accountChannel(roomId, accountId));
        if (isPlayer && presence.connect(roomId, accountId)) {
          socket.to(channel(roomId)).emit("player:update", { accountId, present: true });
        }
      }),
    );

    socket.on("status:update", (payload, ack) =>
      handle(ack, async () => {
        const roomId = Number.parseInt(payload?.roomId, 10);
        if (roomId !== joinedRoomId) throw Object.assign(new Error("Join the room first."), { statusCode: 403 });
        const status = await roomService.updateStatus(roomId, accountId, validateStatusUpdate(payload));
        if (status) io.to(channel(roomId)).emit("player:update", { accountId, ...status });
      }),
    );

    // Delivered only to the recipient's own channel, never the room channel,
    // so the GM and other players never see it.
    socket.on("note:pass", (payload, ack) =>
      handle(ack, async () => {
        const roomId = Number.parseInt(payload?.roomId, 10);
        if (roomId !== joinedRoomId) throw Object.assign(new Error("Join the room first."), { statusCode: 403 });
        const { toAccountId, text } = validateNotePass(payload);
        await roomService.requireNotePassage(roomId, accountId, toAccountId);
        io.to(accountChannel(roomId, toAccountId)).emit("note:received", { text });
      }),
    );

    socket.on("room:leave", () => leave());
    socket.on("disconnect", () => leave());
  });

  return io;
}

module.exports = { attachRoomSocket };
