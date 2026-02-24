import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ClientGameState, GameEvent, PlayerAction } from "@mage-knight/shared";
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

type GameMode = "network" | "rust";

interface BaseGameProviderProps {
  children: ReactNode;
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

type GameProviderProps = NetworkGameProviderProps | RustGameProviderProps;

let nextLogId = 1;

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

  const wsConnectionRef = useRef<WebSocketConnection | null>(null);
  const rustConnectionRef = useRef<RustGameConnection | null>(null);
  const isActionLogEnabledRef = useRef(isActionLogEnabled);
  const epochRef = useRef(0);

  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    isActionLogEnabledRef.current = isActionLogEnabled;
  }, [isActionLogEnabled]);

  // Determine mode and playerId from props
  const mode: GameMode = props.mode;
  const networkProps = props as NetworkGameProviderProps;
  const rustProps = props as RustGameProviderProps;
  const myPlayerId = mode === "rust"
    ? (rustProps.playerId ?? "player_0")
    : networkProps.playerId;

  // Handle state updates from network mode
  const handleStateUpdate = useCallback((newEvents: readonly GameEvent[], newState: ClientGameState) => {
    setEvents((prev) => [...prev, ...newEvents]);
    setState(newState);

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

    if (import.meta.env.DEV) {
      (window as unknown as { __MAGE_KNIGHT_STATE__: ClientGameState }).
        __MAGE_KNIGHT_STATE__ = newState;
    }
  }, []);

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

    if (networkProps.sessionToken) {
      connection.setSessionToken(networkProps.sessionToken);
    }

    wsConnectionRef.current = connection;
    connection.connect();

    return () => {
      connection.disconnect();
      wsConnectionRef.current = null;
    };
  }, [mode, networkProps.gameId, networkProps.playerId, networkProps.serverUrl, networkProps.sessionToken, handleStateUpdate]);

  // Rust mode: connect via WebSocket to mk-server
  useEffect(() => {
    if (mode !== "rust") return;

    const connection = new RustGameConnection({
      serverUrl: rustProps.serverUrl,
      onGameUpdate: (rawState, actions, newEpoch, rawEvents) => {
        const camelState = patchRustState(snakeToCamel(rawState)) as ClientGameState;
        setState(camelState);
        setLegalActions(actions);
        setEpoch(newEpoch);
        epochRef.current = newEpoch;
        if (rawEvents.length > 0) {
          setEvents((prev) => [...prev, ...(rawEvents as GameEvent[])]);
        }

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
  }, [mode, rustProps.serverUrl, rustProps.hero, rustProps.seed]);

  const sendAction = useCallback((action: Parameters<GameContextValue["sendAction"]>[0]) => {
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

    if (mode === "network" && wsConnectionRef.current) {
      wsConnectionRef.current.sendAction(action as PlayerAction);
    } else if (mode === "rust" && rustConnectionRef.current) {
      rustConnectionRef.current.sendAction(action as LegalAction, epochRef.current);
    }
  }, [mode]);

  const saveGame = useCallback((): string | null => {
    return null;
  }, []);

  const loadGame = useCallback((_json: string): void => {
    // Save/load not supported in network/rust modes
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
