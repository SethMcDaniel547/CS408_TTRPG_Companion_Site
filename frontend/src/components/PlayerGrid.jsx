import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

const STATUS_MAX_LENGTH = 100;
const SAVE_DELAY_MS = 400;

// Editable status line and gray-out toggle for the signed-in player's own card.
// The draft is local so typing is never overwritten by incoming updates; it only
// resyncs from the server value while the field is not focused.
function GhostIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M12 2C7.6 2 4 5.5 4 9.9V21l2.7-2 2.6 2 2.7-2 2.7 2 2.6-2 2.7 2V9.9C20 5.5 16.4 2 12 2Zm-3 8.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.48.48 0 0 0-.12-.61l-2.01-1.58ZM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2Z" />
    </svg>
  );
}

function SelfStatus({ player, onStatusChange }) {
  const [draft, setDraft] = useState(player.statusText);
  const focused = useRef(false);
  const timer = useRef(null);

  useEffect(() => {
    if (!focused.current) setDraft(player.statusText);
  }, [player.statusText]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function handleChange(event) {
    const value = event.target.value;
    setDraft(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onStatusChange({ statusText: value }), SAVE_DELAY_MS);
  }

  function handleBlur() {
    focused.current = false;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      onStatusChange({ statusText: draft });
    }
  }

  return (
    <>
      <input
        className="player-status-input"
        type="text"
        value={draft}
        maxLength={STATUS_MAX_LENGTH}
        placeholder="Status"
        aria-label="Your character status"
        onFocus={() => {
          focused.current = true;
        }}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    </>
  );
}

// Grid of the characters being played in a room: token, character name, and a
// status line underneath. Real usernames are intentionally not shown. A card is
// grayed out when its player chose to gray it or is not currently in the room.
export default function PlayerGrid({ players, onStatusChange }) {
  if (!players || players.length === 0) {
    return <p className="room-empty">No players yet.</p>;
  }

  return (
    <ul className="player-grid">
      {players.map((player) => {
        const name = player.name || "No character yet";
        const dimmed = player.grayedOut || !player.present;
        return (
          <li
            className={`player-card${dimmed ? " player-card-gray" : ""}`}
            key={player.accountId}
            data-note-drop={player.isSelf ? undefined : "player"}
            data-note-valid={player.isSelf ? undefined : String(player.present)}
            data-account-id={player.isSelf ? undefined : player.accountId}
          >
            {player.isSelf && (
              <>
                <button
                  className={`card-icon card-icon-left${player.grayedOut ? " card-icon-active" : ""}`}
                  type="button"
                  aria-pressed={player.grayedOut}
                  aria-label="Gray out my character"
                  title={player.grayedOut ? "You are grayed out. Click to return." : "Gray out my character"}
                  onClick={() => onStatusChange({ grayedOut: !player.grayedOut })}
                >
                  <GhostIcon />
                </button>
                <Link
                  className="card-icon card-icon-right"
                  to="/characters"
                  aria-label="Edit character"
                  title="Edit character"
                >
                  <GearIcon />
                </Link>
              </>
            )}
            <div className="player-token">
              {player.tokenUrl ? (
                <img className="token-image" src={player.tokenUrl} alt={`Token for ${name}`} />
              ) : (
                <span className="token-placeholder" aria-hidden="true">
                  {(player.name || "?").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className="player-name">{name}</span>
            {player.isSelf ? (
              <SelfStatus player={player} onStatusChange={onStatusChange} />
            ) : (
              <span className="player-status">
                {player.statusText}
                {!player.present && <em className="player-away"> (away)</em>}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
