/**
 * Asset path helpers for game sprites and images
 */

import type { TacticId } from "@mage-knight/shared";

// Base path for all assets
const ASSETS_BASE = "/assets";

// Tactic ID to file number mapping
const TACTIC_FILE_MAP: Record<TacticId, { time: "day" | "night"; number: number }> = {
  // Day tactics
  early_bird: { time: "day", number: 1 },
  rethink: { time: "day", number: 2 },
  mana_steal: { time: "day", number: 3 },
  planning: { time: "day", number: 4 },
  great_start: { time: "day", number: 5 },
  the_right_moment: { time: "day", number: 6 },
  // Night tactics
  from_the_dusk: { time: "night", number: 1 },
  long_night: { time: "night", number: 2 },
  mana_search: { time: "night", number: 3 },
  midnight_meditation: { time: "night", number: 4 },
  preparation: { time: "night", number: 5 },
  sparing_power: { time: "night", number: 6 },
};

export function getTacticImageUrl(tacticId: TacticId): string {
  const mapping = TACTIC_FILE_MAP[tacticId];
  return `${ASSETS_BASE}/tactics/${mapping.time}_tactic_${mapping.number}.jpg`;
}

export function getEnemyImageUrl(enemyId: string): string {
  // Enemy IDs use underscores, file names use underscores too
  return `${ASSETS_BASE}/enemies/${enemyId}.jpg`;
}

export function getTileImageUrl(tileId: string): string {
  return `${ASSETS_BASE}/tiles/${tileId}.png`;
}

export function getCardSheetUrl(sheet: "basic_actions" | "advanced_actions" | "spells" | "artifacts"): string {
  return `${ASSETS_BASE}/cards/${sheet}.jpg`;
}
