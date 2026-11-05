import { Link } from "react-router-dom";

// Shared roster rendering, used by the room view and room settings. In the old
// code this markup was duplicated across #room and #room-settings and built by
// hand with document.createElement; here it is one reusable component.
//
// - `members`: array of { id, username }
// - `currentUsername`: used to show the "Edit Character" shortcut on self
// - `removable`: whether to show a Remove button per member
// - `onRemove(memberId)`: called when Remove is clicked
export default function MemberList({
  members,
  currentUsername,
  removable = false,
  onRemove,
  emptyText = "No players yet. Add one by username or share the room code.",
}) {
  if (!members || members.length === 0) {
    return (
      <ul className="member-list">
        <li className="room-empty">{emptyText}</li>
      </ul>
    );
  }

  return (
    <ul className="member-list">
      {members.map((member) => (
        <li className="member-item" key={member.id}>
          <span>{member.username}</span>
          <span className="member-actions">
            {member.username === currentUsername && (
              <Link className="button button-small button-secondary" to="/character">
                Edit Character
              </Link>
            )}
            {removable && (
              <button
                className="button button-small button-danger"
                type="button"
                onClick={() => onRemove?.(member.id)}
              >
                Remove
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
