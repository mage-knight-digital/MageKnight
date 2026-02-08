/**
 * Terrain-related modifier effective value calculations
 *
 * Functions for calculating effective movement costs based on terrain,
 * time of day, and active modifiers.
 */

import type { GameState } from "../../state/GameState.js";
import type {
  TerrainCostModifier,
  TerrainSafeModifier,
  TerrainProhibitionModifier,
  ExploreCostReductionModifier,
} from "../../types/modifiers.js";
import type { Terrain, HexCoord } from "@mage-knight/shared";
import { DEFAULT_MOVEMENT_COSTS, TIME_OF_DAY_DAY } from "@mage-knight/shared";
import {
  EFFECT_RULE_OVERRIDE,
  EFFECT_TERRAIN_COST,
  EFFECT_TERRAIN_SAFE,
  EFFECT_TERRAIN_PROHIBITION,
  EFFECT_EXPLORE_COST_REDUCTION,
  RULE_TERRAIN_DAY_NIGHT_SWAP,
  TERRAIN_ALL,
} from "../../types/modifierConstants.js";
import { getModifiersForPlayer } from "./queries.js";

/**
 * Get effective terrain cost for a player entering a hex.
 * @param state - The current game state
 * @param terrain - The terrain type
 * @param playerId - The player ID
 * @param coord - The hex coordinate (optional, used for coordinate-specific modifiers)
 */
export function getEffectiveTerrainCost(
  state: GameState,
  terrain: Terrain,
  playerId: string,
  coord?: HexCoord
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
  let terrainModifiers = getModifiersForPlayer(state, playerId)
    .filter((m) => m.effect.type === EFFECT_TERRAIN_COST)
    .map((m) => m.effect as TerrainCostModifier)
    .filter((e) => e.terrain === terrain || e.terrain === TERRAIN_ALL);

  // Filter by coordinate if provided
  if (coord) {
    terrainModifiers = terrainModifiers.filter((e) => {
      // Include modifiers without specificCoordinate (terrain-wide modifiers)
      if (!e.specificCoordinate) return true;
      // Include coordinate-specific modifiers that match the given coordinate
      return (
        e.specificCoordinate.q === coord.q &&
        e.specificCoordinate.r === coord.r
      );
    });
  } else {
    // If no coordinate provided, exclude coordinate-specific modifiers
    terrainModifiers = terrainModifiers.filter((e) => !e.specificCoordinate);
  }

  let minAllowed = 0;

  // Check for replaceCost modifiers first (e.g., Mist Form sets all terrain to 2)
  // If any replaceCost modifier applies, use the lowest replacement cost
  const replaceModifiers = terrainModifiers.filter(
    (mod): mod is TerrainCostModifier & { replaceCost: number } => mod.replaceCost !== undefined
  );
  if (replaceModifiers.length > 0) {
    // Use the lowest replacement cost (in case multiple sources)
    cost = Math.min(...replaceModifiers.map((mod) => mod.replaceCost));
    for (const mod of replaceModifiers) {
      minAllowed = Math.max(minAllowed, mod.minimum);
    }
  }

  // Apply additive modifiers (always stack with replaceCost if present)
  // Example: Mist Form sets cost to 2, then a unit ability reduces by -1 = final cost 1
  const additiveModifiers = terrainModifiers.filter((mod) => mod.replaceCost === undefined);
  for (const mod of additiveModifiers) {
    cost += mod.amount;
    minAllowed = Math.max(minAllowed, mod.minimum);
  }

  return Math.max(minAllowed, cost);
}

/**
 * Check if a terrain is considered a safe space for a player.
 *
 * Note: This is terrain-only safety (ignores enemies/sites). It treats
 * terrains that are normally impassable (Infinity cost) as unsafe unless
 * an explicit terrain safe modifier applies.
 */
export function isTerrainSafe(
  state: GameState,
  playerId: string,
  terrain: Terrain
): boolean {
  const baseCosts = DEFAULT_MOVEMENT_COSTS[terrain];
  const baseSafe = Boolean(baseCosts) && baseCosts.day !== Infinity && baseCosts.night !== Infinity;

  const safeModifiers = getModifiersForPlayer(state, playerId)
    .filter((m) => m.effect.type === EFFECT_TERRAIN_SAFE)
    .map((m) => m.effect as TerrainSafeModifier)
    .filter((e) => e.terrain === terrain || e.terrain === TERRAIN_ALL);

  return baseSafe || safeModifiers.length > 0;
}

/**
 * Get terrains prohibited for a player by active modifiers.
 * Used by Mist Form spell which prohibits entering hills and mountains.
 */
export function getProhibitedTerrains(
  state: GameState,
  playerId: string
): readonly Terrain[] {
  const prohibitionModifiers = getModifiersForPlayer(state, playerId)
    .filter((m) => m.effect.type === EFFECT_TERRAIN_PROHIBITION)
    .map((m) => m.effect as TerrainProhibitionModifier);

  const prohibited = new Set<Terrain>();
  for (const mod of prohibitionModifiers) {
    for (const terrain of mod.prohibitedTerrains) {
      prohibited.add(terrain);
    }
  }

  return Array.from(prohibited);
}

/**
 * Check if a specific terrain is prohibited for a player.
 */
export function isTerrainProhibited(
  state: GameState,
  playerId: string,
  terrain: Terrain
): boolean {
  return getProhibitedTerrains(state, playerId).includes(terrain);
}

/**
 * Base exploration cost (move points to reveal a new tile).
 */
const BASE_EXPLORE_COST = 2;

/**
 * Get the effective exploration cost for a player.
 * Accounts for modifiers that reduce the cost of exploring (e.g., Feral Allies).
 * The cost cannot go below 0.
 */
export function getEffectiveExploreCost(
  state: GameState,
  playerId: string
): number {
  const reductionModifiers = getModifiersForPlayer(state, playerId)
    .filter((m) => m.effect.type === EFFECT_EXPLORE_COST_REDUCTION)
    .map((m) => m.effect as ExploreCostReductionModifier);

  let cost = BASE_EXPLORE_COST;
  for (const mod of reductionModifiers) {
    cost += mod.amount;
  }

  return Math.max(0, cost);
}
