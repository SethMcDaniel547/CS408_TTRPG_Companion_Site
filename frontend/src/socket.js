import { io } from "socket.io-client";

// Opens the live-update connection. Same origin, so the HttpOnly session cookie
// authenticates the socket. Components own the returned socket's lifetime.
export function connectRoomSocket() {
  return io({ withCredentials: true });
}

// Promise wrapper around an event with an acknowledgement callback.
export function emitWithAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(5000).emit(event, payload, (timeoutError, response) => {
      if (timeoutError) return reject(new Error("The server did not respond."));
      if (!response?.ok) return reject(new Error(response?.error || "Request failed."));
      resolve(response);
    });
  });
}
