// Shared frontend data layer (architecture guide, frontend rules 1 & 2).
// Every network call to the backend goes through this module so view code never
// embeds fetch/axios directly. This keeps API access reusable and testable and
// keeps request/response shaping in one place.
//
// Ported to an ES module for the React build: components import { Api } rather
// than reading a global. The request/response behavior is unchanged from the
// original window.Api implementation.

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

export const Api = {
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

  // Characters
  listCharacters() {
    return request("/api/characters");
  },
  createCharacter({ name, info }) {
    return request("/api/characters", {
      method: "POST",
      body: JSON.stringify({ name, info }),
    });
  },
  updateCharacter(id, { name, info }) {
    return request(`/api/characters/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name, info }),
    });
  },
  deleteCharacter(id) {
    return request(`/api/characters/${id}`, { method: "DELETE" });
  },
  uploadCharacterToken(id, file) {
    return request(`/api/characters/${id}/token`, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
  },

  // Notes
  listNotes() {
    return request("/api/notes");
  },
  createNote({ characterId, title, body }) {
    return request("/api/notes", {
      method: "POST",
      body: JSON.stringify({ characterId, title, body }),
    });
  },
  updateNote(id, { title, body }) {
    return request(`/api/notes/${id}`, {
      method: "PUT",
      body: JSON.stringify({ title, body }),
    });
  },
  deleteNote(id) {
    return request(`/api/notes/${id}`, { method: "DELETE" });
  },

  // Room roster / character selection
  getMemberCharacter(roomId, memberId) {
    return request(`/api/rooms/${roomId}/members/${memberId}/character`);
  },
  getRoster(roomId) {
    return request(`/api/rooms/${roomId}/roster`);
  },
  selectRoomCharacter(roomId, characterId) {
    return request(`/api/rooms/${roomId}/character`, {
      method: "PUT",
      body: JSON.stringify({ characterId }),
    });
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

export default Api;
