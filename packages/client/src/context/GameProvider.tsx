import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ClientGameState, GameEvent } from "@mage-knight/shared";
import { GameContext, type ActionLogEntry, type GameAction, type GameContextValue } from "./GameContext";
import { RustGameConnection, type ConnectionStatus } from "../rust/RustGameConnection";
import type { LegalAction } from "../rust/types";

interface GameProviderProps {
  children: ReactNode;
  serverUrl: string;
  hero: string;
  seed?: number;
  playerId?: string;
}

let nextLogId = 1;

export function GameProvider(props: GameProviderProps) {
  const { children, serverUrl, hero, seed, playerId } = props;
  const [state, setState] = useState<ClientGameState | null>(null);
  const [events, setEvents] = useState<readonly GameEvent[]>([]);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);
  const [isActionLogEnabled, setActionLogEnabled] = useState(true);
  const [legalActions, setLegalActions] = useState<LegalAction[]>([]);
  const [epoch, setEpoch] = useState(0);
  const [rustConnectionStatus, setRustConnectionStatus] = useState<ConnectionStatus | null>(null);

  const rustConnectionRef = useRef<RustGameConnection | null>(null);
  const isActionLogEnabledRef = useRef(isActionLogEnabled);
  const epochRef = useRef(0);

  const myPlayerId = playerId ?? "player_0";

  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    isActionLogEnabledRef.current = isActionLogEnabled;
  }, [isActionLogEnabled]);

  // Connect via WebSocket to mk-server
  useEffect(() => {
    const connection = new RustGameConnection({
      serverUrl,
      onGameUpdate: (rawState, actions, newEpoch, rawEvents) => {
        const gameState = rawState as unknown as ClientGameState;
        setState(gameState);
        setLegalActions(actions);
        setEpoch(newEpoch);
        epochRef.current = newEpoch;
        if (rawEvents.length > 0) {
          setEvents((prev) => [...prev, ...(rawEvents as GameEvent[])]);
        }

        if (import.meta.env.DEV) {
          const player = gameState.players?.[0];
          console.log(
            `[Rust Update] epoch=${newEpoch} phase=${gameState.phase} roundPhase=${gameState.roundPhase}`,
            `currentPlayer=${gameState.currentPlayerId}`,
            `pending=${player?.pending?.kind ?? "none"}`,
            `hand=${Array.isArray(player?.hand) ? player.hand.length : player?.hand} cards`,
            `actions=${actions.length}`,
          );
          console.log("[Rust State]", gameState);
          console.log("[Rust LegalActions]", actions);
        }

        if (import.meta.env.DEV) {
          (window as unknown as { __MAGE_KNIGHT_STATE__: ClientGameState }).
            __MAGE_KNIGHT_STATE__ = gameState;
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
    connection.sendNewGame(hero, seed);

    return () => {
      connection.disconnect();
      rustConnectionRef.current = null;
    };
  }, [serverUrl, hero, seed]);

  const sendAction = useCallback((action: GameAction) => {
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

    if (rustConnectionRef.current) {
      rustConnectionRef.current.sendAction(action as LegalAction, epochRef.current);
    }
  }, []);

  const saveGame = useCallback((): string | null => {
    return null;
  }, []);

  const loadGame = useCallback((_json: string): void => {
    // Save/load not supported in rust mode
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
  };

  // Show loading/connection status
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
