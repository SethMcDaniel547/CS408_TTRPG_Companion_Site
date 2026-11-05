import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

// Gate for the authenticated app views (account, character, room,
// room-settings, notes). Mirrors the old route() behavior: unauthenticated
// users are sent to the landing page. While the initial session check is in
// flight we render nothing to avoid a flash of the wrong view.
export default function ProtectedRoute() {
  const { authenticated, loading } = useAuth();

  if (loading) return null;
  if (!authenticated) return <Navigate to="/" replace />;
  return <Outlet />;
}
