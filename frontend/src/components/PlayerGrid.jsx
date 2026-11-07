import { Link } from "react-router-dom";

// Grid of the characters being played in a room: token, character name, and a
// status line underneath. Real usernames are intentionally not shown. Status is
// a "normal" placeholder until players can edit it.
export default function PlayerGrid({ players }) {
  if (!players || players.length === 0) {
    return <p className="room-empty">No players yet.</p>;
  }

  return (
    <ul className="player-grid">
      {players.map((player) => {
        const name = player.name || "No character yet";
        return (
          <li className="player-card" key={player.accountId}>
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
            <span className="player-status">normal</span>
            {player.isSelf && (
              <Link className="button button-small button-secondary" to="/characters">
                Edit Character
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
