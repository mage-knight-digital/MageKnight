import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { GameServer } from "@mage-knight/server";
import type { ClientGameState, GameEvent, GameConfig, PlayerAction } from "@mage-knight/shared";
import { GameContext, type ActionLogEntry, type GameContextValue } from "./GameContext";
import {
  WebSocketConnection,
  type ConnectionStatusInfo,
  CONNECTION_STATUS_CONNECTING,
  CONNECTION_STATUS_RECONNECTING,
  CONNECTION_STATUS_ERROR,
  CONNECTION_STATUS_DISCONNECTED,
} from "../network/WebSocketConnection";
import { RustGameConnection, type ConnectionStatus } from "../rust/RustGameConnection";
import { snakeToCamel } from "../rust/snakeToCamel";
import { patchRustState } from "../rust/patchRustState";
import type { LegalAction } from "../rust/types";

type GameMode = "local" | "network" | "rust";

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

interface RustGameProviderProps extends BaseGameProviderProps {
  mode: "rust";
  serverUrl: string;
  hero: string;
  seed?: number;
  playerId?: string;
}

type GameProviderProps = LocalGameProviderProps | NetworkGameProviderProps | RustGameProviderProps;

let nextLogId = 1;

/**
 * Get or create a GameServer instance.
 * In development, the server is preserved across HMR updates using import.meta.hot.data
 * to maintain game state (e.g., staying in combat) during code changes.
 * Server is only created when config is provided.
 * Uses dynamic import to avoid bundling server code in network mode.
 */
async function getOrCreateServer(seed?: number, config?: GameConfig): Promise<GameServer | null> {
  if (!config) return null;

  // Dynamically import server to avoid bundling Node.js code in client
  const { createGameServer } = await import("@mage-knight/server");

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
  const [legalActions, setLegalActions] = useState<LegalAction[]>([]);
  const [epoch, setEpoch] = useState(0);
  const [rustConnectionStatus, setRustConnectionStatus] = useState<ConnectionStatus | null>(null);

  const serverRef = useRef<GameServer | null>(null);
  const wsConnectionRef = useRef<WebSocketConnection | null>(null);
  const rustConnectionRef = useRef<RustGameConnection | null>(null);
  const isActionLogEnabledRef = useRef(isActionLogEnabled);
  const epochRef = useRef(0);

  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    isActionLogEnabledRef.current = isActionLogEnabled;
  }, [isActionLogEnabled]);

  // Determine mode and playerId from props
  // Cast to access mode-specific properties — discriminated union can't narrow via derived variable
  const mode: GameMode = props.mode;
  const localProps = props as LocalGameProviderProps;
  const networkProps = props as NetworkGameProviderProps;
  const rustProps = props as RustGameProviderProps;
  const myPlayerId = mode === "local"
    ? (localProps.config.playerIds[0] ?? "player1")
    : mode === "rust"
    ? (rustProps.playerId ?? "player_0")
    : networkProps.playerId;

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

    let isMounted = true;

    // Get existing server (HMR) or create new one
    getOrCreateServer(localProps.seed, localProps.config).then((server) => {
      if (!isMounted) return;
      if (!server) return;

      serverRef.current = server;

      // Connect and receive state updates
      server.connect(myPlayerId, handleStateUpdate);
    });

    return () => {
      isMounted = false;
      if (serverRef.current) {
        serverRef.current.disconnect(myPlayerId);
      }
    };
  }, [mode, props, myPlayerId, handleStateUpdate]);

  // Network mode: connect via WebSocket
  useEffect(() => {
    if (mode !== "network") return;

    const handleConnectionStatusChange = (status: ConnectionStatusInfo) => {
      setConnectionStatus(status);
    };

    const connection = new WebSocketConnection({
      gameId: networkProps.gameId,
      playerId: networkProps.playerId,
      serverUrl: networkProps.serverUrl,
      onStateUpdate: handleStateUpdate,
      onStatusChange: handleConnectionStatusChange,
    });

    // Set session token if provided
    if (networkProps.sessionToken) {
      connection.setSessionToken(networkProps.sessionToken);
    }

    wsConnectionRef.current = connection;
    connection.connect();

    return () => {
      connection.disconnect();
      wsConnectionRef.current = null;
    };
  }, [mode, props, handleStateUpdate]);

  // Rust mode: connect via WebSocket to mk-server
  useEffect(() => {
    if (mode !== "rust") return;

    const connection = new RustGameConnection({
      serverUrl: rustProps.serverUrl,
      onGameUpdate: (rawState, actions, newEpoch) => {
        const camelState = patchRustState(snakeToCamel(rawState)) as ClientGameState;
        setState(camelState);
        setLegalActions(actions);
        setEpoch(newEpoch);
        epochRef.current = newEpoch;

        // Debug: log Rust state updates to diagnose rendering issues
        if (import.meta.env.DEV) {
          const player = camelState.players?.[0];
          const cardActionTypes = actions
            .filter((a: LegalAction) => typeof a !== "string" && (Object.keys(a)[0]?.startsWith("PlayCard")))
            .map((a: LegalAction) => typeof a === "string" ? a : Object.keys(a)[0]);
          console.log(
            `[Rust Update] epoch=${newEpoch} phase=${camelState.phase} roundPhase=${camelState.roundPhase}`,
            `hand=[${player?.hand}]`,
            `selectedTacticId=${player?.selectedTacticId}`,
            `actionCount=${actions.length} cardActions=${cardActionTypes.length}`,
            `tiles=${camelState.map?.tiles?.length ?? 0}`,
            cardActionTypes.length > 0 ? `firstCardAction=${JSON.stringify(actions.find((a: LegalAction) => typeof a !== "string" && Object.keys(a)[0]?.startsWith("PlayCard")))}` : ""
          );
        }

        // Expose state for e2e testing (development only)
        if (import.meta.env.DEV) {
          (window as unknown as { __MAGE_KNIGHT_STATE__: ClientGameState }).
            __MAGE_KNIGHT_STATE__ = camelState;
        }
      },
      onError: (message) => {
        console.error("[mk-server]", message);
      },
      onStatusChange: (status) => {
        setRustConnectionStatus(status);
      },
    });

    rustConnectionRef.current = connection;
    connection.connect();
    connection.sendNewGame(rustProps.hero, rustProps.seed);

    return () => {
      connection.disconnect();
      rustConnectionRef.current = null;
    };
  }, [mode, props]);

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

    // Send via local server, WebSocket connection, or Rust server
    if (mode === "local" && serverRef.current) {
      serverRef.current.handleAction(myPlayerId, action as PlayerAction);
    } else if (mode === "network" && wsConnectionRef.current) {
      wsConnectionRef.current.sendAction(action as PlayerAction);
    } else if (mode === "rust" && rustConnectionRef.current) {
      // In rust mode, action is a LegalAction — send with current epoch
      rustConnectionRef.current.sendAction(action as LegalAction, epochRef.current);
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
    legalActions,
    epoch,
    isRustMode: mode === "rust",
  };

  // Show loading/connection status for rust mode
  if (mode === "rust") {
    if (rustConnectionStatus === "connecting" || rustConnectionStatus === null) {
      return (
        <div className="loading-screen">
          <p>Connecting to Rust server...</p>
        </div>
      );
    }

    if (rustConnectionStatus === "reconnecting") {
      return (
        <div className="loading-screen">
          <p>Reconnecting to Rust server...</p>
        </div>
      );
    }

    if (rustConnectionStatus === "error") {
      return (
        <div className="loading-screen error">
          <p>Connection Error</p>
          <p className="error-message">Failed to connect to Rust server</p>
          <p className="error-hint">
            Make sure mk-server is running: <code>cargo run --release -p mk-server</code>
          </p>
        </div>
      );
    }
  }

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
