/**
 * Debug Display Context
 *
 * Provides debug display settings that can be toggled from the debug panel
 * and consumed by rendering components.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

interface DebugDisplaySettings {
  /** Whether to show hex coordinates on tiles */
  showCoordinates: boolean;
  /** Whether to show boundary edge debug labels */
  showBoundaryEdges: boolean;
  /** Whether to show tile names on the map */
  showTileNames: boolean;
}

interface DebugDisplayContextValue {
  settings: DebugDisplaySettings;
  setShowCoordinates: (show: boolean) => void;
  setShowBoundaryEdges: (show: boolean) => void;
  setShowTileNames: (show: boolean) => void;
}

const defaultSettings: DebugDisplaySettings = {
  showCoordinates: false,
  showBoundaryEdges: false,
  showTileNames: false,
};

const DebugDisplayContext = createContext<DebugDisplayContextValue | null>(null);

export function DebugDisplayProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DebugDisplaySettings>(defaultSettings);

  const setShowCoordinates = useCallback((show: boolean) => {
    setSettings((prev) => ({ ...prev, showCoordinates: show }));
  }, []);

  const setShowBoundaryEdges = useCallback((show: boolean) => {
    setSettings((prev) => ({ ...prev, showBoundaryEdges: show }));
  }, []);

  const setShowTileNames = useCallback((show: boolean) => {
    setSettings((prev) => ({ ...prev, showTileNames: show }));
  }, []);

  const value = useMemo(
    () => ({
      settings,
      setShowCoordinates,
      setShowBoundaryEdges,
      setShowTileNames,
    }),
    [settings, setShowCoordinates, setShowBoundaryEdges, setShowTileNames]
  );

  return (
    <DebugDisplayContext.Provider value={value}>
      {children}
    </DebugDisplayContext.Provider>
  );
}

export function useDebugDisplay(): DebugDisplayContextValue {
  const context = useContext(DebugDisplayContext);
  if (!context) {
    throw new Error("useDebugDisplay must be used within a DebugDisplayProvider");
  }
  return context;
}
