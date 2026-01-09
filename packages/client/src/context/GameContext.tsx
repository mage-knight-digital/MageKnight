import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createGameServer, type GameServer } from "@mage-knight/server";
import type {
  ClientGameState,
  GameEvent,
  PlayerAction,
} from "@mage-knight/shared";

const PLAYER_ID = "player1";

export interface GameContextValue {
  state: ClientGameState | null;
  events: readonly GameEvent[];
  sendAction: (action: PlayerAction) => void;
  myPlayerId: string;
  saveGame: () => string | null;
  loadGame: (json: string) => void;
}

export const GameContext = createContext<GameContextValue | null>(null);

interface GameProviderProps {
  children: ReactNode;
  seed?: number;
}

export function GameProvider({ children, seed }: GameProviderProps) {
  const [state, setState] = useState<ClientGameState | null>(null);
  const [events, setEvents] = useState<readonly GameEvent[]>([]);
  const serverRef = useRef<GameServer | null>(null);

  useEffect(() => {
    // Create game server with optional seed for reproducibility
    const server = createGameServer(seed);

    // Initialize with single player
    server.initializeGame([PLAYER_ID]);

    // Connect and receive state updates
    server.connect(PLAYER_ID, (newEvents, newState) => {
      // Accumulate all events indefinitely (oldest at top, newest at bottom)
      setEvents((prev) => [...prev, ...newEvents]);
      setState(newState);

      // Expose state for e2e testing (development only)
      if (import.meta.env.DEV) {
        (window as unknown as { __MAGE_KNIGHT_STATE__: ClientGameState }).
          __MAGE_KNIGHT_STATE__ = newState;
      }
    });

    serverRef.current = server;

    return () => {
      server.disconnect(PLAYER_ID);
    };
  }, [seed]);

  const sendAction = useCallback((action: PlayerAction) => {
    if (serverRef.current) {
      serverRef.current.handleAction(PLAYER_ID, action);
    }
  }, []);

  const saveGame = useCallback((): string | null => {
    if (serverRef.current) {
      return serverRef.current.saveGame();
    }
    return null;
  }, []);

  const loadGame = useCallback((json: string): void => {
    if (serverRef.current) {
      serverRef.current.loadGame(json);
    }
  }, []);

  const value: GameContextValue = {
    state,
    events,
    sendAction,
    myPlayerId: PLAYER_ID,
    saveGame,
    loadGame,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
