import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Api } from "../api.js";
import { useRoom } from "../context/RoomContext.jsx";

// Game room settings, GM only (view 8). Lists players with remove controls and
// an add-by-username form. The character-detail panel and notes link are
// placeholders, matching the original markup. The gmOnly route guard already
// ensures only the GM reaches this view.
export default function RoomSettings() {
  const { activeRoom } = useRoom();
  const [members, setMembers] = useState([]);
  const [message, setMessage] = useState("");

  const loadMembers = useCallback(async () => {
    if (!activeRoom) return;
    setMessage("");
    try {
      const result = await Api.listMembers(activeRoom.id);
      setMembers(result.members);
    } catch (error) {
      setMessage(error.message);
    }
  }, [activeRoom]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  async function handleAdd(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!activeRoom) return;
    setMessage("Adding...");
    try {
      await Api.addMember(activeRoom.id, form.username.value);
      form.reset();
      setMessage("Player added.");
      await loadMembers();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleRemove(memberId) {
    if (!activeRoom) return;
    try {
      await Api.removeMember(activeRoom.id, memberId);
      await loadMembers();
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (!activeRoom) return null;

  return (
    <section className="view split-view" aria-labelledby="room-settings-title">
      <aside className="sidebar" aria-label="Players">
        <h2 className="sidebar-title">Players</h2>
        <ul className="member-list">
          {members.length === 0 ? (
            <li className="room-empty">No players yet.</li>
          ) : (
            members.map((member) => (
              <li className="member-item" key={member.id}>
                <span>{member.username}</span>
                <button
                  className="button button-small button-danger"
                  type="button"
                  onClick={() => handleRemove(member.id)}
                >
                  Remove
                </button>
              </li>
            ))
          )}
        </ul>
        <form className="inline-form" onSubmit={handleAdd} aria-label="Add a player">
          <label className="visually-hidden" htmlFor="settings-member-username">
            Add player by username
          </label>
          <input
            id="settings-member-username"
            name="username"
            minLength={3}
            maxLength={32}
            pattern="[A-Za-z0-9_]+"
            placeholder="username"
          />
          <button className="button button-small" type="submit">
            Add
          </button>
        </form>
        <p className="form-message" role="status" aria-live="polite">
          {message}
        </p>
      </aside>
      <div className="split-main">
        <div className="split-header">
          <h1 id="room-settings-title">Room settings</h1>
          <div className="token-box" aria-label="Character token">
            <span className="token-placeholder">Token</span>
          </div>
        </div>
        <div className="settings-detail">
          <p className="selected-player">
            Select a player to view their character information.
          </p>
          <Link to="/notes">View notes (shows non-passed notes)</Link>
        </div>
        <Link className="button button-small button-secondary" to="/room">
          Back to room
        </Link>
      </div>
    </section>
  );
}
