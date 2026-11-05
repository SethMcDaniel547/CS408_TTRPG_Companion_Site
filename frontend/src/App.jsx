import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { RoomProvider } from "./context/RoomContext.jsx";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import RequireRoom from "./components/RequireRoom.jsx";
import WideLayoutEffect from "./components/WideLayoutEffect.jsx";
import Home from "./pages/Home.jsx";
import SignIn from "./pages/SignIn.jsx";
import SignUp from "./pages/SignUp.jsx";
import Lobby from "./pages/Lobby.jsx";
import Character from "./pages/Character.jsx";
import Room from "./pages/Room.jsx";
import RoomSettings from "./pages/RoomSettings.jsx";
import Notes from "./pages/Notes.jsx";

// Route table, mirroring the old route() dispatcher:
//   public:  /, /signin, /signup
//   app:     /account, /character, /room, /room-settings, /notes  (auth-gated)
//   /room and /room-settings additionally require an active room;
//   /room-settings requires the GM.
// Unknown paths fall back to the landing page, as the old code did.
export default function App() {
  return (
    <AuthProvider>
      <RoomProvider>
        <WideLayoutEffect />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/account" element={<Lobby />} />
              <Route path="/character" element={<Character />} />
              <Route element={<RequireRoom />}>
                <Route path="/room" element={<Room />} />
              </Route>
              <Route element={<RequireRoom gmOnly />}>
                <Route path="/room-settings" element={<RoomSettings />} />
              </Route>
              <Route path="/notes" element={<Notes />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </RoomProvider>
    </AuthProvider>
  );
}
