import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Api } from "../api.js";

// Holds the current session, mirroring the old `currentUsername` global and the
// session check that `route()` performed on every navigation. Components read
// the session instead of each calling Api.getSession() themselves.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState({ authenticated: false, username: null });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await Api.getSession();
      setSession({
        authenticated: Boolean(result.authenticated),
        username: result.username || null,
      });
      return result;
    } catch {
      setSession({ authenticated: false, username: null });
      return { authenticated: false };
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial session load, equivalent to the first route() call on page load.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const signout = useCallback(async () => {
    await Api.signout();
    setSession({ authenticated: false, username: null });
  }, []);

  const value = {
    session,
    loading,
    username: session.username,
    authenticated: session.authenticated,
    refresh,
    signout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
