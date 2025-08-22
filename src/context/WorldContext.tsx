import React, { createContext, useContext, useState, useCallback } from "react";

interface WorldContextType {
  worldId: string | null;
  setWorldId: (id: string | null) => void;
}

const WorldContext = createContext<WorldContextType>({
  worldId: null,
  setWorldId: () => {},
});

export function WorldProvider({ children }: { children: React.ReactNode }) {
  const [worldId, setWorldIdState] = useState<string | null>(() => {
    try { return localStorage.getItem("worldId"); } catch { return null; }
  });

  const setWorldId = useCallback((id: string | null) => {
    setWorldIdState(id);
    try {
      if (id) localStorage.setItem("worldId", id);
      else localStorage.removeItem("worldId");
    } catch {}
  }, []);

  return (
    <WorldContext.Provider value={{ worldId, setWorldId }}>
      {children}
    </WorldContext.Provider>
  );
}

export const useWorld = () => {
  const context = useContext(WorldContext);
  if (!context) {
    throw new Error("useWorld must be used within a WorldProvider");
  }
  return context;
};