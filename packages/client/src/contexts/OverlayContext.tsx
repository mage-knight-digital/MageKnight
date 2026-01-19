/**
 * Overlay Context
 *
 * Tracks whether any modal overlay is active (card action menu, combat overlay, etc.)
 * Used to disable background interactions like hex tooltips when overlays are shown.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from "react";

interface OverlayContextValue {
  /** Whether any overlay is currently active */
  isOverlayActive: boolean;
  /** Register an overlay as active (returns cleanup function) */
  registerOverlay: () => () => void;
}

const OverlayContext = createContext<OverlayContextValue | null>(null);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [activeOverlays, setActiveOverlays] = useState(0);

  const registerOverlay = useCallback(() => {
    setActiveOverlays((count) => count + 1);
    return () => {
      setActiveOverlays((count) => count - 1);
    };
  }, []);

  const value = useMemo(
    () => ({
      isOverlayActive: activeOverlays > 0,
      registerOverlay,
    }),
    [activeOverlays, registerOverlay]
  );

  return (
    <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>
  );
}

export function useOverlay(): OverlayContextValue {
  const context = useContext(OverlayContext);
  if (!context) {
    throw new Error("useOverlay must be used within an OverlayProvider");
  }
  return context;
}

/**
 * Hook to register a component as an overlay.
 * Call this in overlays that should disable background interactions.
 */
export function useRegisterOverlay(isActive: boolean): void {
  const { registerOverlay } = useOverlay();

  useEffect(() => {
    if (isActive) {
      const unregister = registerOverlay();
      return unregister;
    }
  }, [isActive, registerOverlay]);
}
