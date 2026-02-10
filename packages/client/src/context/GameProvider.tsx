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
import {
  WebSocketConnection,
  type ConnectionStatusInfo,
  CONNECTION_STATUS_CONNECTING,
  CONNECTION_STATUS_RECONNECTING,
  CONNECTION_STATUS_ERROR,
  CONNECTION_STATUS_DISCONNECTED,
} from "../network/WebSocketConnection";

type GameMode = "local" | "network";

interface BaseGameProviderProps {
  children: ReactNode;
}

interface LocalGameProviderProps extends BaseGameProviderProps {
  mode: "local";
  seed?: number;
  config: GameConfig;
}

interface NetworkGameProviderProps extends BaseGameProviderProps {
  mode: "network";
  gameId: string;
  playerId: string;
  serverUrl: string;
  sessionToken?: string;
}

type GameProviderProps = LocalGameProviderProps | NetworkGameProviderProps;

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
      server.initializeGame(config.playerIds, config.heroIds, config.scenarioId, config);
      hotData.server = server;
      hotData.configHash = configHash;
    }
    return hotData.server;
  }

  // Production: create fresh server
  const server = createGameServer(seed);
  server.initializeGame(config.playerIds as string[], config.heroIds, config.scenarioId, config);
  return server;
}

export function GameProvider(props: GameProviderProps) {
  const { children } = props;
  const [state, setState] = useState<ClientGameState | null>(null);
  const [events, setEvents] = useState<readonly GameEvent[]>([]);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);
  const [isActionLogEnabled, setActionLogEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusInfo | null>(null);

  const serverRef = useRef<GameServer | null>(null);
  const wsConnectionRef = useRef<WebSocketConnection | null>(null);
  const isActionLogEnabledRef = useRef(isActionLogEnabled);

  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    isActionLogEnabledRef.current = isActionLogEnabled;
  }, [isActionLogEnabled]);

  // Determine mode and playerId from props
  const mode: GameMode = props.mode;
  const myPlayerId = mode === "local"
    ? (props.config.playerIds[0] ?? "player1")
    : props.playerId;

  // Handle state updates from either local or network mode
  const handleStateUpdate = useCallback((newEvents: readonly GameEvent[], newState: ClientGameState) => {
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
  }, []);

  // Local mode: create embedded game server
  useEffect(() => {
    if (mode !== "local") return;

    // Get existing server (HMR) or create new one
    const server = getOrCreateServer(props.seed, props.config);
    if (!server) return;

    serverRef.current = server;

    // Connect and receive state updates
    server.connect(myPlayerId, handleStateUpdate);

    return () => {
      server.disconnect(myPlayerId);
    };
  }, [mode, props, myPlayerId, handleStateUpdate]);

  // Network mode: connect via WebSocket
  useEffect(() => {
    if (mode !== "network") return;

    const handleConnectionStatusChange = (status: ConnectionStatusInfo) => {
      setConnectionStatus(status);
    };

    const connection = new WebSocketConnection({
      gameId: props.gameId,
      playerId: props.playerId,
      serverUrl: props.serverUrl,
      onStateUpdate: handleStateUpdate,
      onStatusChange: handleConnectionStatusChange,
    });

    // Set session token if provided
    if (props.sessionToken) {
      connection.setSessionToken(props.sessionToken);
    }

    wsConnectionRef.current = connection;
    connection.connect();

    return () => {
      connection.disconnect();
      wsConnectionRef.current = null;
    };
  }, [mode, props, handleStateUpdate]);

  const sendAction = useCallback((action: Parameters<GameContextValue["sendAction"]>[0]) => {
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

    // Send via local server or WebSocket connection
    if (mode === "local" && serverRef.current) {
      serverRef.current.handleAction(myPlayerId, action);
    } else if (mode === "network" && wsConnectionRef.current) {
      wsConnectionRef.current.sendAction(action);
    }
  }, [mode, myPlayerId]);

  const saveGame = useCallback((): string | null => {
    if (mode === "local" && serverRef.current) {
      return serverRef.current.saveGame();
    }
    // Network mode: save/load not supported (server manages state)
    return null;
  }, [mode]);

  const loadGame = useCallback((json: string): void => {
    if (mode === "local" && serverRef.current) {
      serverRef.current.loadGame(json);
    }
    // Network mode: save/load not supported (server manages state)
  }, [mode]);

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

  // Show loading/connection status for network mode
  if (mode === "network") {
    if (!connectionStatus) {
      return (
        <div className="loading-screen">
          <p>Initializing connection...</p>
        </div>
      );
    }

    if (connectionStatus.status === CONNECTION_STATUS_CONNECTING) {
      return (
        <div className="loading-screen">
          <p>Connecting to game server...</p>
        </div>
      );
    }

    if (connectionStatus.status === CONNECTION_STATUS_RECONNECTING) {
      return (
        <div className="loading-screen">
          <p>
            Reconnecting... (attempt {connectionStatus.reconnectAttempt} of{" "}
            {connectionStatus.maxReconnectAttempts})
          </p>
        </div>
      );
    }

    if (connectionStatus.status === CONNECTION_STATUS_ERROR) {
      return (
        <div className="loading-screen error">
          <p>Connection Error</p>
          <p className="error-message">{connectionStatus.error}</p>
          <p className="error-hint">
            {connectionStatus.error?.includes("Session expired")
              ? "Please create a new game or rejoin with a valid session."
              : "Please check your connection and try again."}
          </p>
        </div>
      );
    }

    if (connectionStatus.status === CONNECTION_STATUS_DISCONNECTED) {
      return (
        <div className="loading-screen">
          <p>Disconnected from server</p>
        </div>
      );
    }
  }

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
