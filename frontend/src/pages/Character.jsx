import { useState } from "react";
import { Link } from "react-router-dom";

// Character customization (view 4). The save flow is not wired to the backend
// yet, so submitting shows the same placeholder message as the old script.js.
export default function Character() {
  const [message, setMessage] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    setMessage("Character saving is not wired to the backend yet.");
  }

  return (
    <section className="view split-view" aria-labelledby="character-title">
      <aside className="sidebar" aria-label="Navigation">
        <h2 className="sidebar-title">Menu</h2>
        <nav className="sidebar-nav">
          <Link to="/account">Rooms</Link>
          <Link to="/character" aria-current="page">
            Characters / YourChar
          </Link>
          <Link to="/notes">Notes</Link>
        </nav>
      </aside>
      <div className="split-main">
        <div className="split-header">
          <h1 id="character-title">Character</h1>
          <div className="token-box" aria-label="Character token">
            <span className="token-placeholder">Token</span>
            <input type="file" accept="image/*" aria-label="Upload character token" />
          </div>
        </div>
        <form className="stacked-form" onSubmit={handleSubmit} aria-label="Character details">
          <label htmlFor="character-name">Character name</label>
          <input id="character-name" name="name" maxLength={80} placeholder="Nyx Shadowmoon" />
          <label htmlFor="character-info">Character information</label>
          <textarea
            id="character-info"
            name="info"
            rows="10"
            placeholder="Background, traits, and custom text..."
          />
          <div className="form-actions">
            <button className="button" type="submit">
              Save character
            </button>
            <Link to="/notes">Go to notes</Link>
          </div>
          <p className="form-message" role="status" aria-live="polite">
            {message}
          </p>
        </form>
      </div>
    </section>
  );
}
