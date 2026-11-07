import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Api } from "../api.js";
import { useRoom } from "../context/RoomContext.jsx";
import PlayerGrid from "../components/PlayerGrid.jsx";
import Whiteboard from "../components/placeholders/Whiteboard.jsx";
import DrawingTools from "../components/placeholders/DrawingTools.jsx";
import PassingNotes from "../components/placeholders/PassingNotes.jsx";

// Game room, player + GM view (views 5 & 7). Shows a grid of the characters
// being played in the room (token, character name, status). Adding and removing
// players lives in Room settings (GM only). GM-only controls (drawing tools,
// settings link, delete) are shown conditionally.
export default function Room() {
  const { activeRoom, clearActiveRoom } = useRoom();
  const navigate = useNavigate();

  const [players, setPlayers] = useState([]);
  const [rosterMessage, setRosterMessage] = useState("");

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
                {" · "}
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
          <PlayerGrid players={players} />
          <p className="form-message" role="status" aria-live="polite">
            {rosterMessage}
          </p>
        </div>
        <PassingNotes />

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

