import { useState } from "react";
import { Link } from "react-router-dom";

// View notes (view 6). Not wired to a backend yet; reproduces the notes tree,
// search box, and note pane as a static placeholder matching the old markup.
export default function Notes() {
  const [search, setSearch] = useState("");

  return (
    <section className="view split-view" aria-labelledby="notes-title">
      <aside className="sidebar" aria-label="Notes navigator">
        <h2 className="sidebar-title">Notes</h2>
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
        <nav className="sidebar-nav notes-tree" aria-label="Notes tree">
          <details open>
            <summary>Games</summary>
            <details>
              <summary>Notes</summary>
              <Link to="/notes">note1</Link>
            </details>
          </details>
        </nav>
        <nav className="sidebar-nav">
          <Link to="/account">Rooms</Link>
          <Link to="/character">Characters</Link>
        </nav>
      </aside>
      <div className="split-main">
        <div className="split-header">
          <h1 id="notes-title">Note</h1>
        </div>
        <textarea
          className="note-pane"
          rows="16"
          placeholder="Select a note to read or edit..."
          aria-label="Note contents"
        />
      </div>
    </section>
  );
}
