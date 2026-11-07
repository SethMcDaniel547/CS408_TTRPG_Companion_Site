import { Navigate, Outlet } from "react-router-dom";
import { useRoom } from "../context/RoomContext.jsx";

// Guard for views that require a selected room (/room and /room-settings).
// When no room is active it redirects to the lobby, matching the old route()
// fallback that showed "account" when activeRoom was null.
export default function RequireRoom({ gmOnly = false }) {
  const { activeRoom } = useRoom();

  if (!activeRoom) return <Navigate to="/lobby" replace />;
  if (gmOnly && !activeRoom.isGm) return <Navigate to="/room" replace />;
  return <Outlet />;
}

