import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useCharacters } from "../context/CharacterContext.jsx";

// The one sidebar shared by the Characters and Notes pages. It is rendered by
// SidebarLayout, which stays mounted when switching between those pages, so
// moving between them only swaps the main panel.
export default function AppSidebar() {
  const { characters, notes, activeCharacter, setActiveId, loading } = useCharacters();
  const location = useLocation();
  const [params] = useSearchParams();
  const onCharacters = location.pathname === "/characters";
  const onNotes = location.pathname === "/notes";
  const openNoteId = Number.parseInt(params.get("note"), 10);
  const newNoteFor = Number.parseInt(params.get("newFor"), 10);

  return (
    <aside className="sidebar" aria-label="Navigation">
      <h2 className="sidebar-title">Menu</h2>
      <nav className="sidebar-nav" aria-label="Personal pages">
        <Link to="/lobby">Lobby</Link>

        <details open className="sidebar-group">
          <summary className={onCharacters ? "is-current" : undefined}>Characters</summary>
          <div className="sidebar-sub">
            {loading && characters.length === 0 && <span className="sidebar-empty">Loading...</span>}
            {characters.map((character) => (
              <Link
                key={character.id}
                to="/characters"
                onClick={() => setActiveId(character.id)}
                aria-current={
                  onCharacters && !params.get("new") && activeCharacter?.id === character.id
                    ? "page"
                    : undefined
                }
              >
                {character.name || "Unnamed"}
                {activeCharacter?.id === character.id ? " (active)" : ""}
              </Link>
            ))}
            <Link
              to="/characters?new=1"
              aria-current={onCharacters && params.get("new") ? "page" : undefined}
            >
              + New character
            </Link>
          </div>
        </details>

        <details open className="sidebar-group">
          <summary className={onNotes ? "is-current" : undefined}>Notes</summary>
          <div className="sidebar-sub">
            {characters.length === 0 && (
              <span className="sidebar-empty">Create a character to add notes.</span>
            )}
            {characters.map((character) => {
              const own = notes.filter((note) => note.characterId === character.id);
              const holdsOpen =
                newNoteFor === character.id || own.some((note) => note.id === openNoteId);
              return (
                <details key={character.id} open={holdsOpen || undefined}>
                  <summary>{character.name || "Unnamed"}</summary>
                  <div className="sidebar-sub">
                    {own.map((note) => (
                      <Link
                        key={note.id}
                        to={`/notes?note=${note.id}`}
                        aria-current={onNotes && openNoteId === note.id ? "page" : undefined}
                      >
                        {note.title}
                      </Link>
                    ))}
                    {own.length === 0 && <span className="sidebar-empty">No notes yet.</span>}
                    <Link to={`/notes?newFor=${character.id}`}>+ New note</Link>
                  </div>
                </details>
              );
            })}
          </div>
        </details>
      </nav>
    </aside>
  );
}
