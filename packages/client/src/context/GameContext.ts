import { createContext } from "react";
import type {
  ClientGameState,
  GameEvent,
  PlayerAction,
} from "@mage-knight/shared";

/** A single log entry for debugging actions and events */
export interface ActionLogEntry {
  id: number;
  timestamp: Date;
  type: "action" | "events";
  data: PlayerAction | readonly GameEvent[];
}

export interface GameContextValue {
  state: ClientGameState | null;
  events: readonly GameEvent[];
  sendAction: (action: PlayerAction) => void;
  myPlayerId: string;
  saveGame: () => string | null;
  loadGame: (json: string) => void;
  /** Debug action/event log */
  actionLog: ActionLogEntry[];
  clearActionLog: () => void;
  isActionLogEnabled: boolean;
  setActionLogEnabled: (enabled: boolean) => void;
}

export const GameContext = createContext<GameContextValue | null>(null);
