import { createContext } from "react";
import type {
  ClientGameState,
  GameEvent,
} from "@mage-knight/shared";
import type { LegalAction } from "../rust/types";

/**
 * Action type accepted by sendAction.
 * Phase 1: LegalAction is the canonical type. The `| { type: string; [k: string]: unknown }`
 * union keeps overlay/combat files compiling until Phase 2 migrates them to LegalAction.
 * TODO: Phase 2 — remove the legacy union member once all overlays dispatch LegalAction.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GameAction = LegalAction | { type: string; [k: string]: any };

/** A single log entry for debugging actions and events */
export interface ActionLogEntry {
  id: number;
  timestamp: Date;
  type: "action" | "events";
  data: GameAction | readonly GameEvent[];
}

export interface GameContextValue {
  state: ClientGameState | null;
  events: readonly GameEvent[];
  /** TODO: Phase 2 — narrow to (action: LegalAction) once all overlays use LegalAction. */
  sendAction: (action: GameAction) => void;
  myPlayerId: string;
  saveGame: () => string | null;
  loadGame: (json: string) => void;
  /** Debug action/event log */
  actionLog: ActionLogEntry[];
  clearActionLog: () => void;
  isActionLogEnabled: boolean;
  setActionLogEnabled: (enabled: boolean) => void;
  /** Legal actions from the Rust engine. */
  legalActions: LegalAction[];
  /** Epoch counter for stale-action detection. */
  epoch: number;
}

export const GameContext = createContext<GameContextValue | null>(null);
