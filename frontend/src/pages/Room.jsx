import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useRoom } from "../context/RoomContext.jsx";
import MemberList from "../components/MemberList.jsx";
import Whiteboard from "../components/placeholders/Whiteboard.jsx";
import DrawingTools from "../components/placeholders/DrawingTools.jsx";
import PassingNotes from "../components/placeholders/PassingNotes.jsx";

// Game room, player + GM view (views 5 & 7). GM-only controls (drawing tools,
// add-member form, room settings, delete) are shown conditionally, mirroring
// the old applyGmVisibility(). The roster loads from the backend for the GM;
// players see a read-only roster containing just themselves (matching the old
// renderMembersReadonly()).
export default function Room() {
  const { activeRoom, clearActiveRoom } = useRoom();
  const { username } = useAuth();
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [memberMessage, setMemberMessage] = useState("");
  const addInputRef = useRef(null);

  const isGm = Boolean(activeRoom?.isGm);

  const loadMembers = useCallback(async () => {
    if (!activeRoom) return;
    setMemberMessage("");
    try {
      const result = await Api.listMembers(activeRoom.id);
      setMembers(result.members);
    } catch (error) {
      setMemberMessage(error.message);
    }
  }, [activeRoom]);

  useEffect(() => {
    if (!activeRoom) return;
    if (isGm) {
      loadMembers();
    } else {
      // Players still see themselves with the Edit Character shortcut.
      setMembers([{ id: -1, username }]);
    }
  }, [activeRoom, isGm, loadMembers, username]);

  async function handleAddMember(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!activeRoom) return;
    setMemberMessage("Adding...");
    try {
      const result = await Api.addMember(activeRoom.id, form.username.value);
      form.reset();
      setMemberMessage("Player added.");
      setMembers(result.members);
    } catch (error) {
      setMemberMessage(error.message);
    }
  }

  async function handleRemoveMember(memberId) {
    if (!activeRoom) return;
    try {
      const result = await Api.removeMember(activeRoom.id, memberId);
      setMembers(result.members);
    } catch (error) {
      setMemberMessage(error.message);
    }
  }

  async function handleDeleteRoom() {
    if (!activeRoom) return;
    try {
      await Api.deleteRoom(activeRoom.id);
      clearActiveRoom();
      navigate("/account");
    } catch (error) {
      setMemberMessage(error.message);
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
            <span>{isGm ? "Game Master" : "Player"}</span> · <code>{activeRoom.roomCode}</code>
          </p>
        </div>
        <Whiteboard />
        {isGm && <DrawingTools />}
      </div>

      <aside className="board-sidebar" aria-label="Room tools">
        <div className="sidebar-box">
          <div className="sidebar-box-header">
            <h2>Players &amp; status</h2>
            {isGm && (
              <button
                className="icon-button"
                type="button"
                aria-label="Add player"
                onClick={() => addInputRef.current?.focus()}
              >
                +
              </button>
            )}
          </div>
          {isGm && (
            <form className="inline-form" onSubmit={handleAddMember} aria-label="Add a player">
              <label className="visually-hidden" htmlFor="member-username">
                Add player by username
              </label>
              <input
                id="member-username"
                name="username"
                ref={addInputRef}
                minLength={3}
                maxLength={32}
                pattern="[A-Za-z0-9_]+"
                placeholder="username"
              />
              <button className="button button-small" type="submit">
                Add
              </button>
            </form>
          )}
          <MemberList
            members={members}
            currentUsername={username}
            removable={isGm}
            onRemove={handleRemoveMember}
          />
          <p className="form-message" role="status" aria-live="polite">
            {memberMessage}
          </p>
          <p className="sidebar-help">
            Edit Character button next to your character takes you to character customization.
          </p>
        </div>

        <PassingNotes />

        {isGm && (
          <div className="sidebar-box">
            <h2>Room settings</h2>
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

        <Link className="button button-small button-secondary" to="/account">
          Back to lobby
        </Link>
      </aside>
    </section>
  );
}
