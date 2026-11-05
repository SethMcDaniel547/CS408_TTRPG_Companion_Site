"use strict";

// Shared frontend data layer (architecture guide, frontend rules 1 & 2).
// Every network call to the backend goes through this module so view code never
// embeds fetch/axios directly. This keeps API access reusable and testable and
// keeps request/response shaping in one place.
//
// Exposed on window.Api so the non-module script.js can consume it.
(function () {
  async function request(url, options = {}) {
    const response = await fetch(url, {
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      ...options,
    });
    let result = {};
    try {
      result = await response.json();
    } catch {
      result = {};
    }
    if (!response.ok) {
      throw new Error(result.error || "Unable to complete that request.");
    }
    return result;
  }

  const Api = {
    // Auth
    getSession() {
      return request("/api/auth/me");
    },
    signin(credentials) {
      return request("/api/auth/signin", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
    },
    signup(credentials) {
      return request("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
    },
    signout() {
      return request("/api/auth/signout", { method: "POST" });
    },

    // Rooms
    listRooms() {
      return request("/api/rooms");
    },
    createRoom(roomname) {
      return request("/api/rooms", {
        method: "POST",
        body: JSON.stringify({ roomname }),
      });
    },
    joinRoom(roomCode) {
      return request("/api/rooms/join", {
        method: "POST",
        body: JSON.stringify({ roomCode }),
      });
    },
    deleteRoom(roomId) {
      return request(`/api/rooms/${roomId}`, { method: "DELETE" });
    },

    // Members
    listMembers(roomId) {
      return request(`/api/rooms/${roomId}/members`);
    },
    addMember(roomId, username) {
      return request(`/api/rooms/${roomId}/members`, {
        method: "POST",
        body: JSON.stringify({ username }),
      });
    },
    removeMember(roomId, memberId) {
      return request(`/api/rooms/${roomId}/members/${memberId}`, {
        method: "DELETE",
      });
    },
  };

  window.Api = Api;
})();
