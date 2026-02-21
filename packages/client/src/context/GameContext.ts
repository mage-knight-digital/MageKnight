import { createContext } from "react";
import type {
  ClientGameState,
  GameEvent,
  PlayerAction,
} from "@mage-knight/shared";
import type { LegalAction } from "../rust/types";

/** A single log entry for debugging actions and events */
export interface ActionLogEntry {
  id: number;
  timestamp: Date;
  type: "action" | "events";
  data: PlayerAction | LegalAction | readonly GameEvent[];
}

export interface GameContextValue {
  state: ClientGameState | null;
  events: readonly GameEvent[];
  sendAction: (action: PlayerAction | LegalAction) => void;
  myPlayerId: string;
  saveGame: () => string | null;
  loadGame: (json: string) => void;
  /** Debug action/event log */
  actionLog: ActionLogEntry[];
  clearActionLog: () => void;
  isActionLogEnabled: boolean;
  setActionLogEnabled: (enabled: boolean) => void;
  /** Legal actions from the Rust engine (empty in TS mode). */
  legalActions: LegalAction[];
  /** Epoch counter for stale-action detection (Rust mode only). */
  epoch: number;
  /** Whether we're in Rust server mode. */
  isRustMode: boolean;
}

export const GameContext = createContext<GameContextValue | null>(null);
