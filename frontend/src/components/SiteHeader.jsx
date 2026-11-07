import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useRoom } from "../context/RoomContext.jsx";

// Site header + account navigation. Mirrors the old setNav(): public links
// (Sign in / Sign up) show when signed out; app links (Lobby / Character /
// Notes) and Sign out show when signed in.
export default function SiteHeader() {
  const { authenticated, signout } = useAuth();
  const { clearActiveRoom } = useRoom();

  async function handleSignout() {
    clearActiveRoom();
    await signout();
  }

  return (
    <header className="site-header">
      <Link className="brand" to="/" aria-label="TTRPG Companion home">
        TTRPG Companion
      </Link>
      <nav className="site-nav" aria-label="Account navigation">
        {!authenticated && (
          <>
            <Link to="/signin">Sign in</Link>
            <Link className="button button-small" to="/signup">
              Sign up
            </Link>
          </>
        )}
        {authenticated && (
          <>
            <Link to="/lobby">Lobby</Link>
            <Link to="/characters">Characters</Link>
            <Link to="/notes">Notes</Link>
            <button
              className="button button-small button-secondary"
              type="button"
              onClick={handleSignout}
            >
              Sign out
            </button>
          </>
        )}
      </nav>
    </header>
  );
}

