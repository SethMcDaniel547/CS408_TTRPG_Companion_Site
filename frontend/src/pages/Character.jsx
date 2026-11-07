import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Api } from "../api.js";

const MAX_TOKEN_BYTES = 2 * 1024 * 1024;

// Character customization (view 4). Loads the signed-in player's character,
// saves name/info, and uploads the token image through the shared Api layer.
export default function Character() {
  const [name, setName] = useState("");
  const [info, setInfo] = useState("");
  const [tokenUrl, setTokenUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    Api.getCharacter()
      .then(({ character }) => {
        if (cancelled) return;
        setName(character.name);
        setInfo(character.info);
        setTokenUrl(character.tokenUrl);
      })
      .catch((error) => !cancelled && setMessage(error.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("Saving...");
    try {
      const { character } = await Api.saveCharacter({ name, info });
      setTokenUrl(character.tokenUrl);
      setMessage("Character saved.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleTokenChange(event) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > MAX_TOKEN_BYTES) {
      setMessage("Token images must be 2 MB or smaller.");
      input.value = "";
      return;
    }
    setMessage("Uploading token...");
    try {
      const { character } = await Api.uploadCharacterToken(file);
      setTokenUrl(character.tokenUrl);
      setMessage("Token uploaded.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      input.value = "";
    }
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
            {tokenUrl ? (
              <img
                src={tokenUrl}
                alt={name ? `Token for ${name}` : "Character token"}
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "cover" }}
              />
            ) : (
              <span className="token-placeholder">Token</span>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              aria-label="Upload character token"
              onChange={handleTokenChange}
              disabled={loading}
            />
          </div>
        </div>
        <form className="stacked-form" onSubmit={handleSubmit} aria-label="Character details">
          <label htmlFor="character-name">Character name</label>
          <input
            id="character-name"
            name="name"
            maxLength={80}
            required
            placeholder="Nyx Shadowmoon"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={loading}
          />
          <label htmlFor="character-info">Character information</label>
          <textarea
            id="character-info"
            name="info"
            rows="10"
            maxLength={10000}
            placeholder="Background, traits, and custom text..."
            value={info}
            onChange={(event) => setInfo(event.target.value)}
            disabled={loading}
          />
          <div className="form-actions">
            <button className="button" type="submit" disabled={loading}>
              Save character
            </button>
            <Link to="/notes">Go to notes</Link>
          </div>
          <p className="form-message" role="status" aria-live="polite">
            {loading ? "Loading..." : message}
          </p>
        </form>
      </div>
    </section>
  );
}
