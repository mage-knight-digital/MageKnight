/**
 * Debug Panel Types - Shared types for debug panel components
 */

import type { ClientGameState, PlayerAction } from "@mage-knight/shared";

export interface DebugTabProps {
  state: ClientGameState;
  saveGame: () => string | null;
  loadGame: (json: string) => void;
  sendAction: (action: PlayerAction) => void;
}

export type TabId = "gameplay" | "saveload" | "audio" | "display" | "eventlog";

export interface TabConfig {
  id: TabId;
  label: string;
}

export const TABS: TabConfig[] = [
  { id: "gameplay", label: "Gameplay" },
  { id: "saveload", label: "Save/Load" },
  { id: "audio", label: "Audio" },
  { id: "display", label: "Display" },
  { id: "eventlog", label: "Event Log" },
];
