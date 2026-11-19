import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Api } from "../api.js";
import { connectRoomSocket, emitWithAck } from "../socket.js";
import { useRoom } from "../context/RoomContext.jsx";
import PlayerGrid from "../components/PlayerGrid.jsx";
import Whiteboard from "../components/placeholders/Whiteboard.jsx";
import DrawingTools from "../components/placeholders/DrawingTools.jsx";
import PassingNotes from "../components/PassingNotes.jsx";

// Game room, player + GM view (views 5 & 7). Shows a grid of the characters
// being played in the room (token, character name, status). Adding and removing
// players lives in Room settings (GM only). GM-only controls (drawing tools,
// settings link, delete) are shown conditionally.
export default function Room() {
  const { activeRoom, clearActiveRoom } = useRoom();
  const navigate = useNavigate();

  const [players, setPlayers] = useState([]);
  const [rosterMessage, setRosterMessage] = useState("");

  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [noteSentTo, setNoteSentTo] = useState(null);
  const sentTimer = useRef(null);

  // Briefly labels the recipient's card "Note sent".
  const handleNoteSent = useCallback((accountId) => {
    clearTimeout(sentTimer.current);
    setNoteSentTo(accountId);
    sentTimer.current = setTimeout(() => setNoteSentTo(null), 1600);
  }, []);
  useEffect(() => () => clearTimeout(sentTimer.current), []);

  const isGm = Boolean(activeRoom?.isGm);

  const loadRoster = useCallback(async () => {
    if (!activeRoom) return;
    try {
      const result = await Api.getRoster(activeRoom.id);
      setPlayers(result.players);
      setRosterMessage("");
    } catch (error) {
      setRosterMessage(error.message);
    }
  }, [activeRoom]);

  // Load the roster, then keep it fresh so joins and character changes appear.
  useEffect(() => {
    loadRoster();
    const timer = setInterval(loadRoster, 10000);
    return () => clearInterval(timer);
  }, [loadRoster]);

  // Live updates: join the room channel (marks this player present), reload the
  // roster once joined, and merge per-player changes pushed by the server.
  useEffect(() => {
    if (!activeRoom) return undefined;
    const socket = connectRoomSocket();
    socketRef.current = socket;
    setSocket(socket);

    const join = () => {
      emitWithAck(socket, "room:join", { roomId: activeRoom.id })
        .then(loadRoster)
        .catch((error) => setRosterMessage(error.message));
    };
    const onUpdate = ({ accountId, ...changes }) => {
      setPlayers((current) =>
        current.map((player) => (player.accountId === accountId ? { ...player, ...changes } : player)),
      );
    };

    socket.on("connect", join);
    socket.on("player:update", onUpdate);
    return () => {
      socketRef.current = null;
      setSocket(null);
      socket.disconnect();
    };
  }, [activeRoom, loadRoster]);

  // Saves the player's own status; shown immediately, then confirmed by the server.
  const handleStatusChange = useCallback(
    (changes) => {
      const socket = socketRef.current;
      if (!socket || !activeRoom) return;
      setPlayers((current) =>
        current.map((player) => (player.isSelf ? { ...player, ...changes } : player)),
      );
      emitWithAck(socket, "status:update", { roomId: activeRoom.id, ...changes })
        .then(() => setRosterMessage(""))
        .catch((error) => setRosterMessage(error.message));
    },
    [activeRoom],
  );

  async function handleDeleteRoom() {
    if (!activeRoom) return;
    try {
      await Api.deleteRoom(activeRoom.id);
      clearActiveRoom();
      navigate("/lobby");
    } catch (error) {
      setRosterMessage(error.message);
    }
  }

  if (!activeRoom) return null;

  return (
    <section className="view split-view room-board-view" aria-labelledby="room-title">
      <div className="board-panel">
        <div className="split-header">
          <h1 id="room-title">
            <span>{activeRoom.roomname}</span>
          </h1>
          <p className="room-subtitle">
            <span>{isGm ? "Game Master" : "Player"}</span>
            {isGm && (
              <>
                {" Â· "}
                <code>{activeRoom.roomCode}</code>
              </>
            )}
          </p>
        </div>
        <Whiteboard />
        {isGm && <DrawingTools />}
      </div>

      <aside className="board-sidebar" aria-label="Room tools">
        <div className="sidebar-box">
          <h2>Players</h2>
          <PlayerGrid players={players} onStatusChange={handleStatusChange} noteSentTo={noteSentTo} />
          <p className="form-message" role="status" aria-live="polite">
            {rosterMessage}
          </p>
        </div>
        <PassingNotes socket={socket} roomId={activeRoom.id} players={players} onNoteSent={handleNoteSent} />

        {isGm && (
          <div className="sidebar-box">
            <h2>Room settings</h2>
            <p className="sidebar-help">Add or remove players in settings.</p>
            <Link className="button button-small button-secondary" to="/room-settings">
              Open settings
            </Link>
            <button
              className="button button-small button-danger"
              type="button"
              onClick={handleDeleteRoom}
            >
              Delete room
            </button>
          </div>
        )}

        <Link className="button button-small button-secondary" to="/lobby">
          Back to lobby
        </Link>
      </aside>
    </section>
  );
}

