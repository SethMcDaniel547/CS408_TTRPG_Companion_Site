import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Api } from "../api.js";
import { useCharacters } from "../context/CharacterContext.jsx";

// Notes page (view 6), rendered inside SidebarLayout. The sidebar groups notes
// under each character; this panel searches, reads, and edits them. Select a
// note with ?note=ID, or start one for a character with ?newFor=CHARACTER_ID.
export default function Notes() {
  const { characters, notes, setNotes, loading } = useCharacters();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const noteId = Number.parseInt(params.get("note"), 10);
  const newFor = Number.parseInt(params.get("newFor"), 10);
  const selected = Number.isInteger(noteId) ? notes.find((n) => n.id === noteId) : null;
  const draftCharacter = Number.isInteger(newFor)
    ? characters.find((c) => c.id === newFor)
    : null;
  const editingKey = selected ? `note-${selected.id}` : draftCharacter ? `new-${draftCharacter.id}` : "none";

  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTitle(selected?.title ?? "");
    setBody(selected?.body ?? "");
    setMessage("");
  }, [editingKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const characterName = (id) => characters.find((c) => c.id === id)?.name || "Unnamed";

  const results = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(query) || note.body.toLowerCase().includes(query),
    );
  }, [notes, search]);

  async function handleSave(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("Saving...");
    try {
      if (selected) {
        const { note } = await Api.updateNote(selected.id, { title, body });
        setNotes((current) => current.map((n) => (n.id === note.id ? note : n)));
        setMessage("Note saved.");
      } else if (draftCharacter) {
        const { note } = await Api.createNote({ characterId: draftCharacter.id, title, body });
        setNotes((current) => [...current, note]);
        navigate(`/notes?note=${note.id}`, { replace: true });
      }
    } catch (saveError) {
      setMessage(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!selected || !window.confirm(`Delete "${selected.title}"?`)) return;
    setBusy(true);
    try {
      await Api.deleteNote(selected.id);
      setNotes((current) => current.filter((n) => n.id !== selected.id));
      navigate("/notes", { replace: true });
    } catch (deleteError) {
      setMessage(deleteError.message);
    } finally {
      setBusy(false);
    }
  }

  const editing = Boolean(selected || draftCharacter);

  return (
    <>
      <div className="split-header">
        <h1 id="notes-title">
          {selected
            ? `Note for ${characterName(selected.characterId)}`
            : draftCharacter
              ? `New note for ${draftCharacter.name || "Unnamed"}`
              : "Notes"}
        </h1>
      </div>

      <label className="visually-hidden" htmlFor="notes-search">
        Search notes
      </label>
      <input
        id="notes-search"
        type="search"
        placeholder="Search Notes..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {search.trim() && (
        <ul className="note-results" aria-label="Search results">
          {results.length === 0 ? (
            <li className="room-empty">No notes match your search.</li>
          ) : (
            results.map((note) => (
              <li key={note.id}>
                <Link to={`/notes?note=${note.id}`}>
                  {note.title} <span className="room-meta">({characterName(note.characterId)})</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      )}

      {editing ? (
        <form className="stacked-form" onSubmit={handleSave} aria-labelledby="notes-title">
          <label htmlFor="note-title">Title</label>
          <input
            id="note-title"
            required
            maxLength={120}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={busy}
          />
          <label htmlFor="note-body">Note contents</label>
          <textarea
            id="note-body"
            className="note-pane"
            rows="14"
            maxLength={20000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            disabled={busy}
          />
          <div className="form-actions">
            <button className="button" type="submit" disabled={busy}>
              Save note
            </button>
            {selected && (
              <button className="button button-danger" type="button" onClick={handleDelete} disabled={busy}>
                Delete
              </button>
            )}
          </div>
          <p className="form-message" role="status" aria-live="polite">
            {message}
          </p>
        </form>
      ) : (
        <p className="room-empty">
          {loading
            ? "Loading..."
            : characters.length === 0
              ? "Create a character first, then add notes to it."
              : "Open a character in the sidebar and select a note to read it, or start a new one."}
        </p>
      )}
    </>
  );
}
