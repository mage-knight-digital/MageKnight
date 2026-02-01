/**
 * Terrain-related modifier effective value calculations
 *
 * Functions for calculating effective movement costs based on terrain,
 * time of day, and active modifiers.
 */

import type { GameState } from "../../state/GameState.js";
import type { TerrainCostModifier } from "../../types/modifiers.js";
import type { Terrain } from "@mage-knight/shared";
import { DEFAULT_MOVEMENT_COSTS, TIME_OF_DAY_DAY } from "@mage-knight/shared";
import {
  EFFECT_RULE_OVERRIDE,
  EFFECT_TERRAIN_COST,
  RULE_TERRAIN_DAY_NIGHT_SWAP,
  TERRAIN_ALL,
} from "../modifierConstants.js";
import { getModifiersForPlayer } from "./queries.js";

/**
 * Get effective terrain cost for a player entering a hex.
 */
export function getEffectiveTerrainCost(
  state: GameState,
  terrain: Terrain,
  playerId: string
): number {
  // Base cost from time of day
  const baseCosts = DEFAULT_MOVEMENT_COSTS[terrain];
  if (!baseCosts) return Infinity;

  let cost = state.timeOfDay === TIME_OF_DAY_DAY ? baseCosts.day : baseCosts.night;

  // Check for day/night swap rule
  const swapModifiers = getModifiersForPlayer(state, playerId).filter(
    (m) =>
      m.effect.type === EFFECT_RULE_OVERRIDE &&
      m.effect.rule === RULE_TERRAIN_DAY_NIGHT_SWAP
  );

  if (swapModifiers.length > 0) {
    // Use opposite time of day costs
    cost = state.timeOfDay === TIME_OF_DAY_DAY ? baseCosts.night : baseCosts.day;
  }

  // Apply terrain cost modifiers
  const terrainModifiers = getModifiersForPlayer(state, playerId)
    .filter((m) => m.effect.type === EFFECT_TERRAIN_COST)
    .map((m) => m.effect as TerrainCostModifier)
    .filter((e) => e.terrain === terrain || e.terrain === TERRAIN_ALL);

  let minAllowed = 0;
  for (const mod of terrainModifiers) {
    cost += mod.amount;
    minAllowed = Math.max(minAllowed, mod.minimum);
  }

  return Math.max(minAllowed, cost);
}
