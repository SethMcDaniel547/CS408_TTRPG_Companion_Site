import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Api } from "../api.js";
import { useAuth } from "./AuthContext.jsx";

// Holds the signed-in user's characters and notes plus which character is
// "active" (the one edited on the Characters page and used to join rooms).
// Living above the router means the shared sidebar never reloads or flickers
// when switching between the Characters and Notes pages.
const CharacterContext = createContext(null);

function storageKey(username) {
  return `ttrpg_active_character:${username}`;
}

export function CharacterProvider({ children }) {
  const { authenticated, username } = useAuth();
  const [characters, setCharacters] = useState([]);
  const [notes, setNotes] = useState([]);
  const [activeId, setActiveIdState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [characterResult, noteResult] = await Promise.all([
        Api.listCharacters(),
        Api.listNotes(),
      ]);
      setCharacters(characterResult.characters);
      setNotes(noteResult.notes);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) {
      setCharacters([]);
      setNotes([]);
      setActiveIdState(null);
      return;
    }
    const saved = Number.parseInt(localStorage.getItem(storageKey(username)), 10);
    setActiveIdState(Number.isInteger(saved) ? saved : null);
    reload();
  }, [authenticated, username, reload]);

  const setActiveId = useCallback(
    (id) => {
      setActiveIdState(id);
      if (username && id) localStorage.setItem(storageKey(username), String(id));
    },
    [username],
  );

  // Falls back to the first character if the saved one no longer exists.
  const activeCharacter = useMemo(
    () => characters.find((item) => item.id === activeId) || characters[0] || null,
    [characters, activeId],
  );

  const value = {
    characters,
    notes,
    activeCharacter,
    setActiveId,
    loading,
    error,
    reload,
    setCharacters,
    setNotes,
  };

  return <CharacterContext.Provider value={value}>{children}</CharacterContext.Provider>;
}

export function useCharacters() {
  const context = useContext(CharacterContext);
  if (!context) {
    throw new Error("useCharacters must be used within a CharacterProvider");
  }
  return context;
}
