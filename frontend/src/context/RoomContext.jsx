import { createContext, useCallback, useContext, useState } from "react";

// Holds the currently selected room, mirroring the old `activeRoom` global.
// The /room and /room-settings views require a selected room; when none is set
// they redirect back to the lobby (same guard the old route() performed).
const RoomContext = createContext(null);

export function RoomProvider({ children }) {
  const [activeRoom, setActiveRoom] = useState(null);

  const clearActiveRoom = useCallback(() => setActiveRoom(null), []);

  const value = { activeRoom, setActiveRoom, clearActiveRoom };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error("useRoom must be used within a RoomProvider");
  }
  return context;
}
