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
      setEvents(newEvents);
      setState(newState);
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

  const value: GameContextValue = {
    state,
    events,
    sendAction,
    myPlayerId: PLAYER_ID,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
