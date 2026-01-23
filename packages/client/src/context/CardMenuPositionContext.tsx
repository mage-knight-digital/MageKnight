import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface CardMenuPosition {
  x: number;
  y: number;
}

interface CardMenuPositionContextValue {
  position: CardMenuPosition | null;
  setPosition: (pos: CardMenuPosition | null) => void;
  /** Scale factor for pie menu sizing (1.0 = ready mode, ~2.0 = focus mode) */
  visualScale: number;
  setVisualScale: (scale: number) => void;
}

const CardMenuPositionContext = createContext<CardMenuPositionContextValue | null>(null);

export function CardMenuPositionProvider({ children }: { children: ReactNode }) {
  const [position, setPositionState] = useState<CardMenuPosition | null>(null);
  const [visualScale, setVisualScaleState] = useState<number>(1.0);

  const setPosition = useCallback((pos: CardMenuPosition | null) => {
    setPositionState(pos);
  }, []);

  const setVisualScale = useCallback((scale: number) => {
    setVisualScaleState(scale);
  }, []);

  return (
    <CardMenuPositionContext.Provider value={{ position, setPosition, visualScale, setVisualScale }}>
      {children}
    </CardMenuPositionContext.Provider>
  );
}

export function useCardMenuPosition(): CardMenuPositionContextValue {
  const context = useContext(CardMenuPositionContext);
  if (!context) {
    throw new Error("useCardMenuPosition must be used within CardMenuPositionProvider");
  }
  return context;
}
