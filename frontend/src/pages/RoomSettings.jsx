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
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailMessage, setDetailMessage] = useState("");
  const [openNoteId, setOpenNoteId] = useState(null);

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

  // Load the selected player's character and notes (GM only endpoint).
  useEffect(() => {
    if (!activeRoom || selectedId === null) {
      setDetail(null);
      return undefined;
    }
    let cancelled = false;
    setDetailMessage("Loading...");
    setOpenNoteId(null);
    Api.getMemberCharacter(activeRoom.id, selectedId)
      .then((result) => {
        if (cancelled) return;
        setDetail(result);
        setDetailMessage("");
      })
      .catch((error) => {
        if (cancelled) return;
        setDetail(null);
        setDetailMessage(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [activeRoom, selectedId]);

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
      if (memberId === selectedId) setSelectedId(null);
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
                <button
                  type="button"
                  className="member-select"
                  aria-pressed={selectedId === member.id}
                  onClick={() => setSelectedId(member.id)}
                >
                  {member.username}
                </button>
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
            {detail?.character?.tokenUrl ? (
              <img
                className="token-image"
                src={detail.character.tokenUrl}
                alt={`Token for ${detail.character.name}`}
              />
            ) : (
              <span className="token-placeholder">Token</span>
            )}
          </div>
        </div>
        <div className="settings-detail">
          {selectedId === null ? (
            <p className="selected-player">Select a player to view their character information.</p>
          ) : detail?.character ? (
            <>
              <h2>{detail.character.name || "Unnamed"}</h2>
              <p className="character-info">{detail.character.info || "No character information."}</p>
              <h3>Notes</h3>
              {detail.notes.length === 0 ? (
                <p className="room-empty">This character has no notes.</p>
              ) : (
                <>
                  <ul className="note-results" aria-label="Character notes">
                    {detail.notes.map((note) => (
                      <li key={note.id}>
                        <button
                          type="button"
                          className="member-select"
                          aria-pressed={openNoteId === note.id}
                          onClick={() => setOpenNoteId(note.id)}
                        >
                          {note.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {detail.notes.find((note) => note.id === openNoteId) && (
                    <pre className="note-view">
                      {detail.notes.find((note) => note.id === openNoteId).body || "(empty note)"}
                    </pre>
                  )}
                </>
              )}
            </>
          ) : (
            <p className="selected-player">
              {detailMessage || "This player has not chosen a character in this room yet."}
            </p>
          )}
        </div>
        <Link className="button button-small button-secondary" to="/room">
          Back to room
        </Link>
      </div>
    </section>
  );
}

