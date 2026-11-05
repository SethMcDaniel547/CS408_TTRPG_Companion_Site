// Placeholder: "passing notes" is not wired to a backend yet. Reproduces the
// textarea + view/save controls from the original room sidebar. The buttons do
// not perform any action, matching the pre-migration behavior.
export default function PassingNotes() {
  return (
    <div className="sidebar-box">
      <h2>Passing notes</h2>
      <p className="sidebar-help">Share by clicking Share then a player name in the list.</p>
      <textarea
        className="note-input"
        rows="4"
        placeholder="Pass a note..."
        aria-label="Note to pass"
      />
      <div className="tool-row">
        <button className="icon-button" type="button" aria-label="View notes">
          &#128196;
        </button>
        <button className="icon-button" type="button" aria-label="Save note">
          &#128190;
        </button>
      </div>
      <p className="sidebar-help">Save by clicking Save and it is added to the notes page.</p>
    </div>
  );
}
