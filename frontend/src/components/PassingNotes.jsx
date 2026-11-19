import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createPortal } from "react-dom";
import { Api } from "../api.js";
import { emitWithAck } from "../socket.js";
import { useCharacters } from "../context/CharacterContext.jsx";
import { BALL_RADIUS, useNoteBalls } from "../hooks/useNoteBalls.js";

const NOTE_MAX_LENGTH = 1000;
const TITLE_MAX_LENGTH = 120;

// What a released ball landed on, from the data-note-drop attributes:
//   "player" (a player card, with data-account-id), "editor", or "save".
function dropTargetAt(point) {
  const el = document
    .elementsFromPoint(point.x, point.y)
    .find((candidate) => candidate.closest("[data-note-drop]"));
  const target = el?.closest("[data-note-drop]");
  if (!target) return null;
  return { kind: target.dataset.noteDrop, accountId: Number.parseInt(target.dataset.accountId, 10) };
}

function titleFor(text) {
  const firstLine = text.trim().split("\n")[0].trim();
  return (firstLine || "Passed note").slice(0, TITLE_MAX_LENGTH);
}

// Note passing for the game room. Type a note and press Done to crumple it into
// a physics ball. Drag a ball onto another player's card to send it (it falls in
// from the top of their screen), onto the note area to read or edit it, or onto
// the Save zone to keep it on the notes page. Passed notes go over the room
// socket to the recipient only; the GM never receives them.
export default function PassingNotes({ socket, roomId, players }) {
  const { setNotes } = useCharacters();
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");

  const physics = useNoteBalls({ onDrop: handleDrop });
  const { addBall } = physics;

  // Notes passed to this player fall in from the top.
  useEffect(() => {
    if (!socket) return undefined;
    const onReceived = ({ text }) => {
      if (typeof text === "string") addBall(text, { fromTop: true });
    };
    socket.on("note:received", onReceived);
    return () => socket.off("note:received", onReceived);
  }, [socket, addBall]);

  function handleDone() {
    if (!draft.trim()) {
      setMessage("Write something first.");
      return;
    }
    addBall(draft);
    setDraft("");
    setMessage("");
  }

  async function sendNote(ball, player) {
    try {
      await emitWithAck(socket, "note:pass", { roomId, toAccountId: player.accountId, text: ball.text });
      setMessage(`Note passed to ${player.name || "a player"}.`);
    } catch (error) {
      setMessage(error.message);
      addBall(ball.text);
    }
  }

  async function saveNote(ball, characterId) {
    try {
      const { note } = await Api.createNote({ characterId, title: titleFor(ball.text), body: ball.text });
      setNotes((current) => [...current, note]);
      setMessage("Note saved to your notes page.");
    } catch (error) {
      setMessage(error.message);
      addBall(ball.text);
    }
  }

  // Returns true when the drop consumed the ball.
  function handleDrop(ball, point) {
    const target = dropTargetAt(point);
    if (!target) return false;

    if (target.kind === "editor") {
      if (draft.trim()) addBall(draft); // keep whatever was being written
      setDraft(ball.text);
      setMessage("");
      return true;
    }

    if (target.kind === "player") {
      const player = players.find((p) => p.accountId === target.accountId && !p.isSelf);
      if (!player) return false;
      if (!player.present) {
        setMessage(`${player.name || "That player"} is away and cannot receive notes.`);
        return false;
      }
      if (!socket) {
        setMessage("Not connected to the room.");
        return false;
      }
      sendNote(ball, player);
      return true;
    }

    if (target.kind === "save") {
      const characterId = players.find((p) => p.isSelf)?.characterId;
      if (!characterId) {
        setMessage("Choose a character for this room before saving notes.");
        return false;
      }
      saveNote(ball, characterId);
      return true;
    }

    return false;
  }

  const dragging = physics.draggingId !== null;

  // Lets CSS highlight the valid player cards while a ball is being dragged.
  useEffect(() => {
    document.body.classList.toggle("note-dragging", dragging);
    return () => document.body.classList.remove("note-dragging");
  }, [dragging]);

  return (
    <div className={`sidebar-box${dragging ? " note-drop-target" : ""}`} data-note-drop="editor">
      {dragging ? (
        <h2 className="note-open-label">Open note</h2>
      ) : (
        <>
      <h2>Passing notes</h2>
      <p className="sidebar-help">
        Write a note and press Done. Drag the paper ball onto a player to pass it, back here to read
        or edit it, or onto Save note to keep it.
      </p>
      <textarea
        className="note-input"
        rows="4"
        maxLength={NOTE_MAX_LENGTH}
        placeholder="Pass a note..."
        aria-label="Note to pass"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="tool-row">
        <button className="button button-small" type="button" onClick={handleDone}>
          Done
        </button>
      </div>
      <p className="form-message" role="status" aria-live="polite">
        {message}
      </p>
      <Link className="button button-small button-secondary" to="/notes" state={{ fromRoom: true }}>
        View all notes
      </Link>
        </>
      )}

      {createPortal(
        <>
          <div className="note-ball-layer">
            {physics.balls.map((ball) => (
              <div
                key={ball.id}
                ref={(el) => physics.registerElement(ball.id, el)}
                className={`note-ball${physics.draggingId === ball.id ? " note-ball-dragging" : ""}`}
                style={{ width: BALL_RADIUS * 2, height: BALL_RADIUS * 2 }}
                role="img"
                aria-label="Crumpled note"
                onPointerDown={(event) => physics.startDrag(ball.id, event)}
                onPointerMove={physics.moveDrag}
                onPointerUp={physics.endDrag}
                onPointerCancel={physics.endDrag}
              />
            ))}
          </div>
          <div
            className={`note-save-zone${dragging ? " note-save-zone-active" : ""}`}
            data-note-drop="save"
            aria-hidden={!dragging}
          >
            Save note
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
