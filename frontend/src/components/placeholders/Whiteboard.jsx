// Placeholder: the shared whiteboard canvas is not wired to a backend yet.
// Renders the same static panel the original index.html showed in the room view.
export default function Whiteboard() {
  return (
    <div className="whiteboard" role="img" aria-label="Shared whiteboard canvas">
      <span className="whiteboard-placeholder">Whiteboard</span>
    </div>
  );
}
