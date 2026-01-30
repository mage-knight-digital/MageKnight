import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createGameServer, type GameServer } from "@mage-knight/server";
import type { ClientGameState, GameEvent, GameConfig } from "@mage-knight/shared";
import { GameContext, type ActionLogEntry, type GameContextValue } from "./GameContext";

interface GameProviderProps {
  children: ReactNode;
  seed?: number;
  /** Game configuration from setup screen */
  config: GameConfig;
}

let nextLogId = 1;

/**
 * Get or create a GameServer instance.
 * In development, the server is preserved across HMR updates using import.meta.hot.data
 * to maintain game state (e.g., staying in combat) during code changes.
 * Server is only created when config is provided.
 */
function getOrCreateServer(seed?: number, config?: GameConfig): GameServer | null {
  if (!config) return null;

  if (import.meta.hot) {
    const hotData = import.meta.hot.data as {
      server?: GameServer;
      configHash?: string;
    };

    // Hash config to detect changes (e.g., different hero selections)
    const configHash = JSON.stringify([config.playerIds, config.heroIds, config.scenarioId]);

    // Development: preserve server across HMR updates, but recreate if config changes
    if (!hotData.server || hotData.configHash !== configHash) {
      const server = createGameServer(seed);
      server.initializeGame(config.playerIds, config.heroIds, config.scenarioId);
      hotData.server = server;
      hotData.configHash = configHash;
    }
    return hotData.server;
  }

  // Production: create fresh server
  const server = createGameServer(seed);
  server.initializeGame(config.playerIds as string[], config.heroIds, config.scenarioId);
  return server;
}

export function GameProvider({ children, seed, config }: GameProviderProps) {
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

  // Get the player ID for this client (first player in config)
  const myPlayerId = config.playerIds[0] ?? "player1";

  useEffect(() => {
    // Get existing server (HMR) or create new one
    const server = getOrCreateServer(seed, config);
    if (!server) return;

    serverRef.current = server;

    // Connect and receive state updates
    server.connect(myPlayerId, (newEvents, newState) => {
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
      server.disconnect(myPlayerId);
    };
  }, [seed, config, myPlayerId]);

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
      serverRef.current.handleAction(myPlayerId, action);
    }
  }, [myPlayerId]);

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
    myPlayerId,
    saveGame,
    loadGame,
    actionLog,
    clearActionLog,
    isActionLogEnabled,
    setActionLogEnabled,
  };

  // Show loading state until game is initialized
  if (!state) {
    return (
      <div className="loading-screen">
        <p>Initializing game...</p>
      </div>
    );
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
