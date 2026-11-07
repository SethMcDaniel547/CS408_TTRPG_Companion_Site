import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Api } from "../api.js";
import { useCharacters } from "../context/CharacterContext.jsx";

const MAX_TOKEN_BYTES = 2 * 1024 * 1024;

// Characters page (view 4), rendered inside SidebarLayout. Edits the active
// character, or creates a new one when opened with ?new=1. A token chosen
// before the first save is uploaded right after the character is created.
export default function Character() {
  const { characters, activeCharacter, setActiveId, setCharacters, loading, error } =
    useCharacters();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const creating = Boolean(params.get("new")) || (!loading && characters.length === 0);
  const target = creating ? null : activeCharacter;

  const [name, setName] = useState("");
  const [info, setInfo] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // Reset the form whenever a different character (or "new") is shown.
  const targetId = target?.id ?? null;
  const targetName = target?.name ?? "";
  const targetInfo = target?.info ?? "";
  useEffect(() => {
    setName(targetName);
    setInfo(targetInfo);
    setPendingFile(null);
    setMessage("");
  }, [targetId, creating]); // eslint-disable-line react-hooks/exhaustive-deps

  // Local preview for a not-yet-uploaded file.
  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  function replaceInList(saved) {
    setCharacters((current) => {
      const exists = current.some((item) => item.id === saved.id);
      const next = exists
        ? current.map((item) => (item.id === saved.id ? saved : item))
        : [...current, saved];
      return next.sort(
        (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.id - b.id,
      );
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("Saving...");
    try {
      let saved;
      if (target) {
        ({ character: saved } = await Api.updateCharacter(target.id, { name, info }));
      } else {
        ({ character: saved } = await Api.createCharacter({ name, info }));
      }
      if (pendingFile) {
        ({ character: saved } = await Api.uploadCharacterToken(saved.id, pendingFile));
        setPendingFile(null);
      }
      replaceInList(saved);
      setActiveId(saved.id);
      if (!target) navigate("/characters", { replace: true });
      setMessage("Character saved.");
    } catch (saveError) {
      setMessage(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  function handleTokenChange(event) {
    const input = event.target;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (file.size > MAX_TOKEN_BYTES) {
      setMessage("Token images must be 2 MB or smaller.");
      return;
    }
    setPendingFile(file);
    setMessage(target ? "Token ready. Save to upload it." : "Token ready. It uploads when you save.");
  }

  async function handleDelete() {
    if (!target || !window.confirm(`Delete ${target.name || "this character"} and its notes?`)) {
      return;
    }
    setBusy(true);
    try {
      await Api.deleteCharacter(target.id);
      setCharacters((current) => current.filter((item) => item.id !== target.id));
      setMessage("");
    } catch (deleteError) {
      setMessage(deleteError.message);
    } finally {
      setBusy(false);
    }
  }

  const shownToken = previewUrl || target?.tokenUrl || null;

  return (
    <>
      <div className="split-header">
        <h1 id="character-title">{target ? "Character" : "New character"}</h1>
        <div className="token-box" aria-label="Character token">
          {shownToken ? (
            <img
              className="token-image"
              src={shownToken}
              alt={name ? `Token for ${name}` : "Character token"}
            />
          ) : (
            <span className="token-placeholder">Token</span>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            aria-label="Upload character token"
            onChange={handleTokenChange}
            disabled={loading || busy}
          />
        </div>
      </div>
      <form className="stacked-form" onSubmit={handleSubmit} aria-labelledby="character-title">
        <label htmlFor="character-name">Character name</label>
        <input
          id="character-name"
          name="name"
          maxLength={80}
          required
          placeholder="Pinion The Artificer"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={loading || busy}
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
          disabled={loading || busy}
        />
        <div className="form-actions">
          <button className="button" type="submit" disabled={loading || busy}>
            {target ? "Save character" : "Create character"}
          </button>
          {target && (
            <button
              className="button button-danger"
              type="button"
              onClick={handleDelete}
              disabled={busy}
            >
              Delete
            </button>
          )}
        </div>
        <p className="form-message" role="status" aria-live="polite">
          {loading ? "Loading..." : error || message}
        </p>
      </form>
    </>
  );
}
