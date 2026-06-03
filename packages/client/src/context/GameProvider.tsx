import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  GAME_LAUNCH_MODE_HOTSEAT,
  type ClientGameState,
  type GameConfig,
  type GameEvent,
} from "@mage-knight/shared";
import { GameContext, type ActionLogEntry, type GameAction, type GameContextValue } from "./GameContext";
import { RustGameConnection, type ConnectionStatus } from "../rust/RustGameConnection";
import type { LegalAction } from "../rust/types";
import { HotseatPassScreen } from "../components/HotseatPassScreen";

interface GameProviderProps {
  children: ReactNode;
  serverUrl: string;
  gameConfig: GameConfig;
  seed?: number;
  playerId?: string;
}

interface GameUpdatePayload {
  readonly state: ClientGameState;
  readonly legalActions: LegalAction[];
  readonly epoch: number;
  readonly events: readonly GameEvent[];
}

let nextLogId = 1;

export function GameProvider(props: GameProviderProps) {
  const { children, serverUrl, gameConfig, seed, playerId } = props;
  const [state, setState] = useState<ClientGameState | null>(null);
  const [events, setEvents] = useState<readonly GameEvent[]>([]);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);
  const [isActionLogEnabled, setActionLogEnabled] = useState(true);
  const [legalActions, setLegalActions] = useState<LegalAction[]>([]);
  const [epoch, setEpoch] = useState(0);
  const [visiblePlayerId, setVisiblePlayerId] = useState(playerId ?? "player_0");
  const [pendingHotseatUpdate, setPendingHotseatUpdate] =
    useState<GameUpdatePayload | null>(null);
  const [rustConnectionStatus, setRustConnectionStatus] = useState<ConnectionStatus | null>(null);

  const rustConnectionRef = useRef<RustGameConnection | null>(null);
  const isActionLogEnabledRef = useRef(isActionLogEnabled);
  const epochRef = useRef(0);
  const stateRef = useRef<ClientGameState | null>(null);
  const visiblePlayerIdRef = useRef(visiblePlayerId);

  const isHotseat = gameConfig.launchMode === GAME_LAUNCH_MODE_HOTSEAT;
  const myPlayerId = isHotseat ? visiblePlayerId : playerId ?? "player_0";

  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    isActionLogEnabledRef.current = isActionLogEnabled;
  }, [isActionLogEnabled]);

  useEffect(() => {
    visiblePlayerIdRef.current = visiblePlayerId;
  }, [visiblePlayerId]);

  const applyGameUpdate = useCallback((update: GameUpdatePayload) => {
    const nextPlayerId =
      update.state.currentPlayerId || update.state.players[0]?.id || "player_0";
    stateRef.current = update.state;
    setState(update.state);
    setLegalActions([...update.legalActions]);
    setEpoch(update.epoch);
    epochRef.current = update.epoch;
    visiblePlayerIdRef.current = nextPlayerId;
    setVisiblePlayerId(nextPlayerId);

    if (update.events.length > 0) {
      setEvents((prev) => [...prev, ...update.events]);
    }

    if (import.meta.env.DEV) {
      (window as unknown as { __MAGE_KNIGHT_STATE__: ClientGameState }).
        __MAGE_KNIGHT_STATE__ = update.state;
    }
  }, []);

  const handleHotseatContinue = useCallback(() => {
    if (!pendingHotseatUpdate) return;
    applyGameUpdate(pendingHotseatUpdate);
    setPendingHotseatUpdate(null);
  }, [applyGameUpdate, pendingHotseatUpdate]);

  // Connect via WebSocket to mk-server
  useEffect(() => {
    const connection = new RustGameConnection({
      serverUrl,
      onGameUpdate: (rawState, actions, newEpoch, rawEvents) => {
        const gameState = rawState as unknown as ClientGameState;
        const update: GameUpdatePayload = {
          state: gameState,
          legalActions: actions,
          epoch: newEpoch,
          events: rawEvents as GameEvent[],
        };
        const incomingPlayerId =
          gameState.currentPlayerId || gameState.players[0]?.id || "player_0";

        if (
          isHotseat &&
          stateRef.current != null &&
          incomingPlayerId !== visiblePlayerIdRef.current
        ) {
          setPendingHotseatUpdate(update);
          return;
        }

        applyGameUpdate(update);

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
    connection.sendNewGame(gameConfig, seed);

    return () => {
      connection.disconnect();
      rustConnectionRef.current = null;
    };
  }, [serverUrl, gameConfig, seed, isHotseat, applyGameUpdate]);

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

  const pendingPlayer = pendingHotseatUpdate?.state.players.find(
    (candidate) => candidate.id === pendingHotseatUpdate.state.currentPlayerId
  );

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

  return (
    <GameContext.Provider value={value}>
      {children}
      {pendingHotseatUpdate && (
        <HotseatPassScreen
          playerId={pendingHotseatUpdate.state.currentPlayerId}
          hero={pendingPlayer?.hero}
          onContinue={handleHotseatContinue}
        />
      )}
    </GameContext.Provider>
  );
}
