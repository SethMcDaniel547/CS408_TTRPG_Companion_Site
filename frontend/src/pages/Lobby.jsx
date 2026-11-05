import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useRoom } from "../context/RoomContext.jsx";

// Lobby dashboard (view 3). Owns the room list (the old `roomCache` global),
// with client-side search + sort, plus the create/join forms. Opening a room
// sets it as the active room and navigates to /room.
export default function Lobby() {
  const { username } = useAuth();
  const { setActiveRoom, clearActiveRoom } = useRoom();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [roomsMessage, setRoomsMessage] = useState("");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState("name");

  const [createMessage, setCreateMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [joinMessage, setJoinMessage] = useState("");
  const [joining, setJoining] = useState(false);

  const loadRooms = useCallback(async () => {
    setRoomsMessage("Loading rooms...");
    try {
      const result = await Api.listRooms();
      setRooms(result.rooms);
      setRoomsMessage("");
    } catch (error) {
      setRoomsMessage(error.message);
    }
  }, []);

  // Entering the lobby clears any active room (matches the old route()
  // behavior of resetting activeRoom when target === "account").
  useEffect(() => {
    clearActiveRoom();
    loadRooms();
  }, [clearActiveRoom, loadRooms]);

  // Filter + sort, mirroring renderRoomList() + sortRooms().
  const visibleRooms = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = rooms.filter((room) => room.roomname.toLowerCase().includes(query));
    const sorted = [...filtered];
    if (sortMode === "players") {
      sorted.sort(
        (a, b) => b.playerCount - a.playerCount || a.roomname.localeCompare(b.roomname),
      );
    } else {
      sorted.sort((a, b) => a.roomname.localeCompare(b.roomname));
    }
    return sorted;
  }, [rooms, search, sortMode]);

  function openRoom(roomId) {
    const room = rooms.find((item) => item.id === roomId) || null;
    if (!room) return;
    setActiveRoom(room);
    navigate("/room");
  }

  async function handleCreate(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setCreating(true);
    setCreateMessage("Creating...");
    try {
      const result = await Api.createRoom(form.roomname.value);
      form.reset();
      setCreateMessage(`Created “${result.room.roomname}”. Code: ${result.room.roomCode}`);
      await loadRooms();
    } catch (error) {
      setCreateMessage(error.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setJoining(true);
    setJoinMessage("Joining...");
    try {
      const result = await Api.joinRoom(form.roomCode.value);
      form.reset();
      setJoinMessage(`Joined “${result.room.roomname}”.`);
      await loadRooms();
    } catch (error) {
      setJoinMessage(error.message);
    } finally {
      setJoining(false);
    }
  }

  return (
    <section className="view lobby-view" aria-labelledby="account-title">
      <h1 id="account-title">
        Welcome, <span>{username}</span>.
      </h1>

      <div className="lobby">
        <div className="lobby-forms">
          <form className="room-form" onSubmit={handleCreate} aria-label="Create a game room">
            <h2>Create a room</h2>
            <label htmlFor="create-roomname">Room name</label>
            <input
              id="create-roomname"
              name="roomname"
              required
              minLength={1}
              maxLength={64}
              placeholder="Room Name"
            />
            <button className="button" type="submit" disabled={creating}>
              Create as GM
            </button>
            <p className="form-message" role="status" aria-live="polite">
              {createMessage}
            </p>
          </form>

          <form className="room-form" onSubmit={handleJoin} aria-label="Join a game room">
            <h2>Join a room</h2>
            <label htmlFor="join-code">Room code</label>
            <input
              id="join-code"
              name="roomCode"
              required
              minLength={8}
              maxLength={8}
              autoCapitalize="characters"
              placeholder="ABCD2345"
            />
            <button className="button" type="submit" disabled={joining}>
              Join
            </button>
            <p className="form-message" role="status" aria-live="polite">
              {joinMessage}
            </p>
          </form>
        </div>

        <div className="lobby-dashboard">
          <div className="lobby-controls">
            <h2>Your rooms</h2>
            <label className="visually-hidden" htmlFor="room-filter">
              Filter rooms
            </label>
            <select
              id="room-filter"
              aria-label="Filter rooms"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value)}
            >
              <option value="name">Filter: Name</option>
              <option value="players">Filter: Player Count</option>
            </select>
            <label className="visually-hidden" htmlFor="room-search">
              Search rooms
            </label>
            <input
              id="room-search"
              type="search"
              placeholder="Search rooms..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <p className="lobby-note">Shows games only you can see.</p>
          <p className="form-message" role="status" aria-live="polite">
            {roomsMessage}
          </p>
          <ul className="room-list">
            {visibleRooms.length === 0 ? (
              <li className="room-empty">
                {rooms.length === 0
                  ? "No rooms yet. Create one or join with a code."
                  : "No rooms match your search."}
              </li>
            ) : (
              visibleRooms.map((room) => {
                const gmPresence = room.isGm ? "You are GM" : "GM present";
                const players =
                  room.playerCount === 1 ? "1 player" : `${room.playerCount} players`;
                return (
                  <li className="room-item" key={room.id}>
                    <button
                      type="button"
                      className="room-open"
                      onClick={() => openRoom(room.id)}
                    >
                      <span className="room-name">{room.roomname}</span>
                      <span className="room-meta">
                        {gmPresence} · {players} · {room.roomCode}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>

      <div className="lobby-footer">
        <Link className="button button-secondary" to="/character">
          Edit Character
        </Link>
      </div>
    </section>
  );
}
