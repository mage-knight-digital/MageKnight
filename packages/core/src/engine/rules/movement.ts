/**
 * Shared movement rules.
 *
 * These helpers are used by both validators and ValidActions computation
 * to prevent rule drift.
 */

import type { GameState } from "../../state/GameState.js";
import type { HexCoord } from "@mage-knight/shared";
import { hexKey } from "@mage-knight/shared";
import { SiteType, type HexState } from "../../types/map.js";
import { getEffectiveTerrainCost, isTerrainProhibited, isRuleActive } from "../modifiers/index.js";
import { RULE_IGNORE_RAMPAGING_PROVOKE } from "../../types/modifierConstants.js";

export const MOVE_ENTRY_BLOCK_HEX_MISSING = "MOVE_ENTRY_BLOCK_HEX_MISSING" as const;
export const MOVE_ENTRY_BLOCK_TERRAIN_PROHIBITED =
  "MOVE_ENTRY_BLOCK_TERRAIN_PROHIBITED" as const;
export const MOVE_ENTRY_BLOCK_IMPASSABLE = "MOVE_ENTRY_BLOCK_IMPASSABLE" as const;
export const MOVE_ENTRY_BLOCK_RAMPAGING = "MOVE_ENTRY_BLOCK_RAMPAGING" as const;
export const MOVE_ENTRY_BLOCK_CITY = "MOVE_ENTRY_BLOCK_CITY" as const;

export type MoveEntryBlockReason =
  | typeof MOVE_ENTRY_BLOCK_HEX_MISSING
  | typeof MOVE_ENTRY_BLOCK_TERRAIN_PROHIBITED
  | typeof MOVE_ENTRY_BLOCK_IMPASSABLE
  | typeof MOVE_ENTRY_BLOCK_RAMPAGING
  | typeof MOVE_ENTRY_BLOCK_CITY;

export interface MoveEntryEvaluation {
  cost: number;
  reason: MoveEntryBlockReason | null;
}

export function getHexAtCoord(
  state: GameState,
  coord: HexCoord
): HexState | undefined {
  return state.map.hexes[hexKey(coord)];
}

/**
 * Evaluate whether a hex can be entered and at what cost.
 * Returns a block reason if entry is not allowed.
 */
export function evaluateMoveEntry(
  state: GameState,
  playerId: string,
  hex: HexState | undefined,
  coord?: HexCoord
): MoveEntryEvaluation {
  if (!hex) {
    return { cost: Infinity, reason: MOVE_ENTRY_BLOCK_HEX_MISSING };
  }

  // Terrain prohibition (e.g., Mist Form)
  if (isTerrainProhibited(state, playerId, hex.terrain)) {
    return { cost: Infinity, reason: MOVE_ENTRY_BLOCK_TERRAIN_PROHIBITED };
  }

  const cost = getEffectiveTerrainCost(state, hex.terrain, playerId, coord);
  if (cost === Infinity) {
    return { cost: Infinity, reason: MOVE_ENTRY_BLOCK_IMPASSABLE };
  }

  if (hex.rampagingEnemies.length > 0 && hex.enemies.length > 0) {
    if (!isRuleActive(state, playerId, RULE_IGNORE_RAMPAGING_PROVOKE)) {
      return { cost: Infinity, reason: MOVE_ENTRY_BLOCK_RAMPAGING };
    }
  }

  if (hex.site?.type === SiteType.City && !state.scenarioConfig.citiesCanBeEntered) {
    return { cost: Infinity, reason: MOVE_ENTRY_BLOCK_CITY };
  }

  return { cost, reason: null };
}
