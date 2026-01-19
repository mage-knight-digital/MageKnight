/**
 * PixiAppContext - Shared PixiJS Application for all rendering
 *
 * Provides a single PixiJS Application instance that components can use
 * to add their own screen-space overlays. This avoids the WebGL context
 * conflicts that occur when multiple PixiJS Applications are created.
 *
 * Architecture:
 * - PixiHexGrid creates the Application and provides it via this context
 * - Other components (FloatingHand, OfferView) add Containers to stage.ui
 * - Screen-space overlays are managed via registerOverlay/unregisterOverlay
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Application, Container } from "pixi.js";

interface PixiAppContextValue {
  /** The shared PixiJS Application (null until initialized) */
  app: Application | null;
  /** Register the Application (called by PixiHexGrid) */
  setApp: (app: Application | null) => void;
  /** Register a screen-space overlay container */
  registerOverlay: (id: string, container: Container) => void;
  /** Unregister a screen-space overlay container */
  unregisterOverlay: (id: string) => void;
  /** The screen-space overlay layer (added last to stage for topmost z-order) */
  overlayLayer: Container | null;
  /** Set the overlay layer (called by PixiHexGrid) */
  setOverlayLayer: (layer: Container | null) => void;
}

const PixiAppContext = createContext<PixiAppContextValue | null>(null);

interface PixiAppProviderProps {
  children: ReactNode;
}

export function PixiAppProvider({ children }: PixiAppProviderProps) {
  const [app, setAppState] = useState<Application | null>(null);
  const [overlayLayer, setOverlayLayerState] = useState<Container | null>(null);
  const [overlays] = useState<Map<string, Container>>(new Map());

  const setApp = useCallback((newApp: Application | null) => {
    setAppState(newApp);
  }, []);

  const setOverlayLayer = useCallback((layer: Container | null) => {
    setOverlayLayerState(layer);
  }, []);

  const registerOverlay = useCallback((id: string, container: Container) => {
    if (overlayLayer) {
      overlays.set(id, container);
      overlayLayer.addChild(container);
    }
  }, [overlayLayer, overlays]);

  const unregisterOverlay = useCallback((id: string) => {
    const container = overlays.get(id);
    if (container) {
      overlays.delete(id);
      if (container.parent) {
        container.parent.removeChild(container);
      }
      container.destroy({ children: true });
    }
  }, [overlays]);

  const value: PixiAppContextValue = {
    app,
    setApp,
    registerOverlay,
    unregisterOverlay,
    overlayLayer,
    setOverlayLayer,
  };

  return (
    <PixiAppContext.Provider value={value}>
      {children}
    </PixiAppContext.Provider>
  );
}

export function usePixiApp(): PixiAppContextValue {
  const context = useContext(PixiAppContext);
  if (!context) {
    throw new Error("usePixiApp must be used within PixiAppProvider");
  }
  return context;
}
