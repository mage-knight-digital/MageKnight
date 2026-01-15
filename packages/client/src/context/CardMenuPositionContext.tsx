import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface CardMenuPosition {
  x: number;
  y: number;
}

interface CardMenuPositionContextValue {
  position: CardMenuPosition | null;
  setPosition: (pos: CardMenuPosition | null) => void;
}

const CardMenuPositionContext = createContext<CardMenuPositionContextValue | null>(null);

export function CardMenuPositionProvider({ children }: { children: ReactNode }) {
  const [position, setPositionState] = useState<CardMenuPosition | null>(null);

  const setPosition = useCallback((pos: CardMenuPosition | null) => {
    setPositionState(pos);
  }, []);

  return (
    <CardMenuPositionContext.Provider value={{ position, setPosition }}>
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
