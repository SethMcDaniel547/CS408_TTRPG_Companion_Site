// Placeholder: GM drawing tools are not wired up yet. The buttons are disabled,
// matching the original markup. Rendered only for the GM in the room view.
export default function DrawingTools() {
  return (
    <div className="drawing-tools" aria-label="Drawing tools">
      <span className="tools-label">Drawing tools</span>
      <div className="tool-row">
        <button className="button button-small button-secondary" type="button" disabled>
          Pen
        </button>
        <button className="button button-small button-secondary" type="button" disabled>
          Erase
        </button>
        <button className="button button-small button-secondary" type="button" disabled>
          Shape
        </button>
      </div>
    </div>
  );
}
