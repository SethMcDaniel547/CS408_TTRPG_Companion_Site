const views = [...document.querySelectorAll(".view")];

const publicViews = ["home", "signin", "signup"];
const appViews = ["account", "character", "room", "room-settings", "notes"];

let roomCache = [];
let activeRoom = null;
let currentUsername = null;

async function getSession() {
  const response = await fetch("/api/auth/me");
  return response.json();
}

async function api(url, options = {}) {
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
  if (!response.ok) throw new Error(result.error || "Unable to complete that request.");
  return result;
}

function showView(viewId) {
  views.forEach((view) => {
    view.hidden = view.id !== viewId;
  });
}

function setNav(authenticated) {
  document.querySelectorAll("[data-nav-auth]").forEach((el) => { el.hidden = authenticated; });
  document.querySelectorAll("[data-nav-app]").forEach((el) => { el.hidden = !authenticated; });
  document.querySelector("[data-signout]").hidden = !authenticated;
}

// Clean path-based navigation (no #hash) using the History API.
function navigate(path) {
  if (window.location.pathname !== path) window.history.pushState({}, "", path);
}

async function route() {
  const session = await getSession();
  setNav(session.authenticated);

  if (!session.authenticated) {
    currentUsername = null;
    const requested = window.location.pathname.slice(1);
    showView(publicViews.includes(requested) ? requested : "home");
    return;
  }

  currentUsername = session.username;
  document.querySelector("[data-username]").textContent = session.username;
  const requested = window.location.pathname.slice(1);
  const target = appViews.includes(requested) ? requested : "account";

  // Views that require a selected room fall back to the lobby when none is set.
  if (["room", "room-settings"].includes(target) && !activeRoom) {
    showView("account");
    navigate("/account");
    await loadRooms();
    return;
  }

  showView(target);

  if (target === "account") {
    activeRoom = null;
    await loadRooms();
  } else if (target === "room") {
    renderRoomView();
  } else if (target === "room-settings") {
    renderRoomSettings();
  }
}

/* ---------- Lobby dashboard ---------- */

function sortRooms(rooms) {
  const mode = document.querySelector("[data-room-sort]").value;
  const sorted = [...rooms];
  if (mode === "players") {
    sorted.sort((a, b) => b.playerCount - a.playerCount || a.roomname.localeCompare(b.roomname));
  } else {
    sorted.sort((a, b) => a.roomname.localeCompare(b.roomname));
  }
  return sorted;
}

function renderRoomList() {
  const list = document.querySelector("[data-room-list]");
  const query = document.querySelector("[data-room-search]").value.trim().toLowerCase();
  const filtered = roomCache.filter((room) => room.roomname.toLowerCase().includes(query));
  const rooms = sortRooms(filtered);
  list.textContent = "";

  if (rooms.length === 0) {
    const empty = document.createElement("li");
    empty.className = "room-empty";
    empty.textContent = roomCache.length === 0
      ? "No rooms yet. Create one or join with a code."
      : "No rooms match your search.";
    list.appendChild(empty);
    return;
  }

  rooms.forEach((room) => {
    const item = document.createElement("li");
    item.className = "room-item";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "room-open";
    button.addEventListener("click", () => openRoom(room.id));

    const name = document.createElement("span");
    name.className = "room-name";
    name.textContent = room.roomname;

    const meta = document.createElement("span");
    meta.className = "room-meta";
    const gmPresence = room.isGm ? "You are GM" : "GM present";
    const players = room.playerCount === 1 ? "1 player" : `${room.playerCount} players`;
    meta.textContent = `${gmPresence} · ${players} · ${room.roomCode}`;

    button.append(name, meta);
    item.appendChild(button);
    list.appendChild(item);
  });
}

async function loadRooms() {
  const message = document.querySelector("[data-rooms-message]");
  message.textContent = "Loading rooms...";
  try {
    const result = await api("/api/rooms");
    roomCache = result.rooms;
    message.textContent = "";
    renderRoomList();
  } catch (error) {
    message.textContent = error.message;
  }
}

function openRoom(roomId) {
  activeRoom = roomCache.find((room) => room.id === roomId) || null;
  if (!activeRoom) return;
  navigate("/room");
  route();
}

/* ---------- Game room (player / GM view) ---------- */

function applyGmVisibility(isGm) {
  document.querySelectorAll("#room [data-gm-controls]").forEach((el) => { el.hidden = !isGm; });
}

function renderRoomView() {
  if (!activeRoom) {
    navigate("/account");
    route();
    return;
  }
  document.querySelector("[data-room-name]").textContent = activeRoom.roomname;
  document.querySelector("[data-room-code]").textContent = activeRoom.roomCode;
  document.querySelector("[data-room-role]").textContent = activeRoom.isGm ? "Game Master" : "Player";
  applyGmVisibility(activeRoom.isGm);

  if (activeRoom.isGm) {
    document.querySelector("#room [data-member-message]").textContent = "";
    loadMembers("[data-member-list]");
  } else {
    // Players still see the roster (read-only).
    renderMembersReadonly("[data-member-list]");
  }
}

function memberEntry(member, { removable }) {
  const item = document.createElement("li");
  item.className = "member-item";

  const name = document.createElement("span");
  name.textContent = member.username;
  item.appendChild(name);

  const actions = document.createElement("span");
  actions.className = "member-actions";

  if (member.username === currentUsername) {
    const edit = document.createElement("a");
    edit.href = "/character";
    edit.className = "button button-small button-secondary";
    edit.textContent = "Edit Character";
    actions.appendChild(edit);
  }

  if (removable) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "button button-small button-danger";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => removeMember(member.id));
    actions.appendChild(remove);
  }

  item.appendChild(actions);
  return item;
}

async function loadMembers(listSelector) {
  const list = document.querySelector(`#room ${listSelector}`);
  if (!list) return;
  list.textContent = "";
  try {
    const result = await api(`/api/rooms/${activeRoom.id}/members`);
    renderMembers(result.members, listSelector, { removable: true });
  } catch (error) {
    document.querySelector("#room [data-member-message]").textContent = error.message;
  }
}

function renderMembersReadonly(listSelector) {
  const list = document.querySelector(`#room ${listSelector}`);
  list.textContent = "";
  // Players can at least see themselves with the Edit Character shortcut.
  const self = { id: -1, username: currentUsername };
  list.appendChild(memberEntry(self, { removable: false }));
}

function renderMembers(members, listSelector, { removable }) {
  const list = document.querySelector(`#room ${listSelector}`);
  list.textContent = "";
  if (members.length === 0) {
    const empty = document.createElement("li");
    empty.className = "room-empty";
    empty.textContent = "No players yet. Add one by username or share the room code.";
    list.appendChild(empty);
    return;
  }
  members.forEach((member) => list.appendChild(memberEntry(member, { removable })));
}

async function removeMember(memberId) {
  try {
    const result = await api(`/api/rooms/${activeRoom.id}/members/${memberId}`, { method: "DELETE" });
    renderMembers(result.members, "[data-member-list]", { removable: true });
    if (!document.getElementById("room-settings").hidden) renderRoomSettings();
  } catch (error) {
    document.querySelector("#room [data-member-message]").textContent = error.message;
  }
}

/* ---------- Game room settings (GM) ---------- */

async function renderRoomSettings() {
  if (!activeRoom || !activeRoom.isGm) {
    navigate(activeRoom ? "/room" : "/account");
    route();
    return;
  }
  const list = document.querySelector("[data-settings-member-list]");
  list.textContent = "";
  document.querySelector("[data-settings-member-message]").textContent = "";
  try {
    const result = await api(`/api/rooms/${activeRoom.id}/members`);
    if (result.members.length === 0) {
      const empty = document.createElement("li");
      empty.className = "room-empty";
      empty.textContent = "No players yet.";
      list.appendChild(empty);
    } else {
      result.members.forEach((member) => {
        const item = document.createElement("li");
        item.className = "member-item";
        const name = document.createElement("span");
        name.textContent = member.username;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "button button-small button-danger";
        remove.textContent = "Remove";
        remove.addEventListener("click", async () => {
          try {
            await api(`/api/rooms/${activeRoom.id}/members/${member.id}`, { method: "DELETE" });
            renderRoomSettings();
          } catch (error) {
            document.querySelector("[data-settings-member-message]").textContent = error.message;
          }
        });
        item.append(name, remove);
        list.appendChild(item);
      });
    }
  } catch (error) {
    document.querySelector("[data-settings-member-message]").textContent = error.message;
  }
}

/* ---------- Auth forms ---------- */

document.querySelectorAll(".auth-form").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = form.querySelector(".form-message");
    const submitButton = form.querySelector("button");
    submitButton.disabled = true;
    message.textContent = "Working...";
    const data = Object.fromEntries(new FormData(form));
    try {
      await api(`/api/auth/${form.dataset.auth}`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      navigate("/account");
      await route();
    } catch (error) {
      message.textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  });
});

document.querySelector("[data-signout]").addEventListener("click", async () => {
  await fetch("/api/auth/signout", { method: "POST" });
  activeRoom = null;
  roomCache = [];
  navigate("/");
  await route();
});

/* ---------- Room forms ---------- */

document.querySelector("[data-room-create]").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector("[data-create-message]");
  const button = form.querySelector("button");
  button.disabled = true;
  message.textContent = "Creating...";
  try {
    const result = await api("/api/rooms", {
      method: "POST",
      body: JSON.stringify({ roomname: form.roomname.value }),
    });
    form.reset();
    message.textContent = `Created “${result.room.roomname}”. Code: ${result.room.roomCode}`;
    await loadRooms();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

document.querySelector("[data-room-join]").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector("[data-join-message]");
  const button = form.querySelector("button");
  button.disabled = true;
  message.textContent = "Joining...";
  try {
    const result = await api("/api/rooms/join", {
      method: "POST",
      body: JSON.stringify({ roomCode: form.roomCode.value }),
    });
    form.reset();
    message.textContent = `Joined “${result.room.roomname}”.`;
    await loadRooms();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

// Toggle the inline "add player" form via the + icon in the room sidebar.
const addToggle = document.querySelector("[data-member-add-toggle]");
if (addToggle) {
  const addForm = document.querySelector("#room [data-member-add]");
  addToggle.addEventListener("click", () => {
    const input = addForm.querySelector("input");
    input.focus();
  });
}

document.querySelector("#room [data-member-add]").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector("#room [data-member-message]");
  const button = form.querySelector("button");
  if (!activeRoom) return;
  button.disabled = true;
  message.textContent = "Adding...";
  try {
    const result = await api(`/api/rooms/${activeRoom.id}/members`, {
      method: "POST",
      body: JSON.stringify({ username: form.username.value }),
    });
    form.reset();
    message.textContent = "Player added.";
    renderMembers(result.members, "[data-member-list]", { removable: true });
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

document.querySelector("[data-settings-member-add]").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector("[data-settings-member-message]");
  const button = form.querySelector("button");
  if (!activeRoom) return;
  button.disabled = true;
  message.textContent = "Adding...";
  try {
    await api(`/api/rooms/${activeRoom.id}/members`, {
      method: "POST",
      body: JSON.stringify({ username: form.username.value }),
    });
    form.reset();
    message.textContent = "Player added.";
    renderRoomSettings();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

document.querySelector("[data-room-delete]").addEventListener("click", async () => {
  if (!activeRoom) return;
  const message = document.querySelector("#room [data-member-message]");
  try {
    await api(`/api/rooms/${activeRoom.id}`, { method: "DELETE" });
    activeRoom = null;
    navigate("/account");
    await route();
  } catch (error) {
    message.textContent = error.message;
  }
});

/* ---------- Scaffolded forms (no backend yet) ---------- */

document.querySelector("[data-character-form]").addEventListener("submit", (event) => {
  event.preventDefault();
  document.querySelector("[data-character-message]").textContent =
    "Character saving is not wired to the backend yet.";
});

document.querySelector("[data-room-search]").addEventListener("input", renderRoomList);
document.querySelector("[data-room-sort]").addEventListener("change", renderRoomList);

// Intercept in-app link clicks so navigation stays client-side with clean paths.
document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href^='/']");
  if (!link) return;
  if (link.target === "_blank" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(link.getAttribute("href"));
  route();
});

window.addEventListener("popstate", route);
route().catch(() => showView("home"));
