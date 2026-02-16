import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import type { ClientGameState } from "@mage-knight/shared";
import { GameContext, type GameContextValue } from "./GameContext";
import { ReplayContext, type ReplayContextValue } from "./ReplayContext";

// ---------------------------------------------------------------------------
// Artifact types (matches Python SDK reporting.py)
// ---------------------------------------------------------------------------

interface ArtifactRunMetadata {
  seed: number;
  outcome: string;
  steps: number;
  reason?: string;
}

interface ArtifactMessageLogEntry {
  player_id: string;
  message_type: string;
  payload: {
    events?: unknown[];
    state?: ClientGameState;
  };
}

export interface ArtifactData {
  run: ArtifactRunMetadata;
  actionTrace: unknown[];
  messageLog: ArtifactMessageLogEntry[];
}

// ---------------------------------------------------------------------------
// Frame extraction
// ---------------------------------------------------------------------------

interface ReplayFrame {
  state: ClientGameState;
}

function extractFrames(artifact: ArtifactData, playerId: string): ReplayFrame[] {
  const frames: ReplayFrame[] = [];
  for (const entry of artifact.messageLog) {
    if (
      entry.player_id === playerId &&
      entry.message_type === "state_update" &&
      entry.payload?.state
    ) {
      frames.push({ state: entry.payload.state });
    }
  }
  return frames;
}

/** Get unique player IDs from the artifact message log */
export function getPlayerIds(artifact: ArtifactData): string[] {
  const ids = new Set<string>();
  for (const entry of artifact.messageLog) {
    if (entry.message_type === "state_update" && entry.payload?.state) {
      ids.add(entry.player_id);
    }
  }
  return [...ids];
}

/** Basic structural validation of artifact JSON */
export function isValidArtifact(data: unknown): data is ArtifactData {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.run === "object" &&
    obj.run !== null &&
    Array.isArray(obj.messageLog)
  );
}

// ---------------------------------------------------------------------------
// ReplayProvider
// ---------------------------------------------------------------------------

const SPEED_OPTIONS = [0.5, 1, 2, 4, 8] as const;
const BASE_INTERVAL_MS = 1000;

// No-op functions for the GameContext
const NOOP_SEND_ACTION = () => {};
const NOOP_SAVE_GAME = () => null;
const NOOP_LOAD_GAME = () => {};
const NOOP_CLEAR_LOG = () => {};

interface ReplayProviderProps {
  artifact: ArtifactData;
  playerId: string;
  children: ReactNode;
}

export { SPEED_OPTIONS };

export function ReplayProvider({ artifact, playerId, children }: ReplayProviderProps) {
  const frames = useMemo(
    () => extractFrames(artifact, playerId),
    [artifact, playerId]
  );

  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const frameIndexRef = useRef(frameIndex);
  frameIndexRef.current = frameIndex;

  const speedRef = useRef(speed);
  speedRef.current = speed;

  const maxIndex = frames.length - 1;

  // Navigation callbacks (always defined, even if frames is empty)
  const goToFrame = useCallback(
    (index: number) => {
      setFrameIndex(Math.max(0, Math.min(index, maxIndex)));
    },
    [maxIndex]
  );

  const stepForward = useCallback(() => {
    setFrameIndex((prev) => Math.min(prev + 1, maxIndex));
  }, [maxIndex]);

  const stepBack = useCallback(() => {
    setFrameIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleSetSpeed = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
  }, []);

  // Auto-advance timer
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;

    const intervalId = setInterval(() => {
      if (frameIndexRef.current >= maxIndex) {
        setIsPlaying(false);
        return;
      }
      setFrameIndex((prev) => prev + 1);
    }, BASE_INTERVAL_MS / speedRef.current);

    return () => clearInterval(intervalId);
  }, [isPlaying, speed, frames.length, maxIndex]);

  // Build GameContext value from current frame
  const currentState = frames.length > 0 ? frames[frameIndex].state : null;

  const gameValue: GameContextValue = useMemo(
    () => ({
      state: currentState,
      events: [],
      sendAction: NOOP_SEND_ACTION,
      myPlayerId: playerId,
      saveGame: NOOP_SAVE_GAME,
      loadGame: NOOP_LOAD_GAME,
      actionLog: [],
      clearActionLog: NOOP_CLEAR_LOG,
      isActionLogEnabled: false,
      setActionLogEnabled: NOOP_CLEAR_LOG,
    }),
    [currentState, playerId]
  );

  // Build ReplayContext value
  const replayValue: ReplayContextValue = useMemo(
    () => ({
      frameIndex,
      totalFrames: frames.length,
      isPlaying,
      speed,
      runMetadata: {
        seed: artifact.run.seed,
        outcome: artifact.run.outcome,
        steps: artifact.run.steps,
        reason: artifact.run.reason,
      },
      goToFrame,
      stepForward,
      stepBack,
      togglePlay,
      setSpeed: handleSetSpeed,
    }),
    [
      frameIndex,
      frames.length,
      isPlaying,
      speed,
      artifact.run,
      goToFrame,
      stepForward,
      stepBack,
      togglePlay,
      handleSetSpeed,
    ]
  );

  // Error: no frames found (after all hooks)
  if (frames.length === 0) {
    return (
      <div className="loading-screen error">
        <p>No replay frames found</p>
        <p className="error-message">
          No state_update messages found for player &ldquo;{playerId}&rdquo; in
          this artifact.
        </p>
      </div>
    );
  }

  return (
    <ReplayContext.Provider value={replayValue}>
      <GameContext.Provider value={gameValue}>{children}</GameContext.Provider>
    </ReplayContext.Provider>
  );
}
