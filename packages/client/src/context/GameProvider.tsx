import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createGameServer, type GameServer } from "@mage-knight/server";
import type { ClientGameState, GameEvent } from "@mage-knight/shared";
import { GameContext, type ActionLogEntry, type GameContextValue } from "./GameContext";

const PLAYER_ID = "player1";

interface GameProviderProps {
  children: ReactNode;
  seed?: number;
}

let nextLogId = 1;

/**
 * Get or create a GameServer instance.
 * In development, the server is preserved across HMR updates using import.meta.hot.data
 * to maintain game state (e.g., staying in combat) during code changes.
 */
function getOrCreateServer(seed?: number): GameServer {
  if (import.meta.hot) {
    // Development: preserve server across HMR updates
    if (!import.meta.hot.data.server) {
      import.meta.hot.data.server = createGameServer(seed);
      import.meta.hot.data.server.initializeGame([PLAYER_ID]);
    }
    return import.meta.hot.data.server;
  }
  // Production: create fresh server
  const server = createGameServer(seed);
  server.initializeGame([PLAYER_ID]);
  return server;
}

export function GameProvider({ children, seed }: GameProviderProps) {
  const [state, setState] = useState<ClientGameState | null>(null);
  const [events, setEvents] = useState<readonly GameEvent[]>([]);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);
  const [isActionLogEnabled, setActionLogEnabled] = useState(true);
  const serverRef = useRef<GameServer | null>(null);
  const isActionLogEnabledRef = useRef(isActionLogEnabled);

  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    isActionLogEnabledRef.current = isActionLogEnabled;
  }, [isActionLogEnabled]);

  useEffect(() => {
    // Get existing server (HMR) or create new one
    const server = getOrCreateServer(seed);
    serverRef.current = server;

    // Connect and receive state updates
    server.connect(PLAYER_ID, (newEvents, newState) => {
      // Accumulate all events indefinitely (oldest at top, newest at bottom)
      setEvents((prev) => [...prev, ...newEvents]);
      setState(newState);

      // Log events for debugging
      if (isActionLogEnabledRef.current && newEvents.length > 0) {
        setActionLog((prev) => [
          ...prev,
          {
            id: nextLogId++,
            timestamp: new Date(),
            type: "events",
            data: newEvents,
          },
        ]);
      }

      // Expose state for e2e testing (development only)
      if (import.meta.env.DEV) {
        (window as unknown as { __MAGE_KNIGHT_STATE__: ClientGameState }).
          __MAGE_KNIGHT_STATE__ = newState;
      }
    });

    return () => {
      server.disconnect(PLAYER_ID);
    };
  }, [seed]);

  const sendAction = useCallback((action: Parameters<GameContextValue["sendAction"]>[0]) => {
    if (serverRef.current) {
      // Log action for debugging
      if (isActionLogEnabledRef.current) {
        setActionLog((prev) => [
          ...prev,
          {
            id: nextLogId++,
            timestamp: new Date(),
            type: "action",
            data: action,
          },
        ]);
      }
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

  const clearActionLog = useCallback(() => {
    setActionLog([]);
  }, []);

  const value: GameContextValue = {
    state,
    events,
    sendAction,
    myPlayerId: PLAYER_ID,
    saveGame,
    loadGame,
    actionLog,
    clearActionLog,
    isActionLogEnabled,
    setActionLogEnabled,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
