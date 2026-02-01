/**
 * Terrain-based effect resolvers
 *
 * Handles effects that depend on the terrain the player is currently on.
 * - TerrainBasedBlock: Block value equals terrain's unmodified movement cost,
 *   with Fire element during day and Ice element at night/underground.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { TerrainBasedBlockEffect, GainBlockEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { applyGainBlock } from "./atomicEffects.js";
import {
  hexKey,
  DEFAULT_MOVEMENT_COSTS,
  TIME_OF_DAY_NIGHT,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  TERRAIN_LAKE,
  TERRAIN_MOUNTAIN,
  TERRAIN_OCEAN,
} from "@mage-knight/shared";
import { EFFECT_GAIN_BLOCK } from "../../types/effectTypes.js";

/**
 * Get the unmodified movement cost for the terrain at the player's position.
 * Returns the DAY cost (since "unmodified" means the base cost, not time-adjusted).
 *
 * Special cases:
 * - Lake: Returns 2 (boat required to be on lake)
 * - Mountain: Returns 5 (shouldn't normally be on mountain, but fallback)
 * - Ocean: Returns 2 (shouldn't normally be on ocean, but fallback)
 * - Dungeon/Tomb: Uses the site's terrain cost (usually city = 2)
 */
function getUnmodifiedTerrainCost(state: GameState, player: Player): number {
  if (!player.position) {
    return 2; // Fallback if no position
  }

  const hex = state.map.hexes[hexKey(player.position)];
  if (!hex) {
    return 2; // Fallback if hex not found
  }

  const terrain = hex.terrain;
  const costs = DEFAULT_MOVEMENT_COSTS[terrain];

  // For impassable terrain, use reasonable fallback values
  // (Player shouldn't normally be on these, but handle gracefully)
  if (costs.day === Infinity) {
    // Lake = 2 (with boat), Mountain = 5, Ocean = 2
    if (terrain === TERRAIN_LAKE) return 2;
    if (terrain === TERRAIN_MOUNTAIN) return 5;
    if (terrain === TERRAIN_OCEAN) return 2;
    return 2; // Generic fallback
  }

  // Use day cost as the "unmodified" base cost
  return costs.day;
}

/**
 * Determine if we're in "night-like" conditions for element purposes.
 * True if:
 * - It's night time
 * - OR we're in underground combat (dungeon/tomb)
 *
 * Per FAQ S1: Dungeons and Tombs count as "night" for this effect.
 */
function isNightLikeConditions(state: GameState): boolean {
  return state.timeOfDay === TIME_OF_DAY_NIGHT || (state.combat?.nightManaRules ?? false);
}

/**
 * Resolve a terrain-based block effect.
 *
 * Block value = unmodified movement cost of current terrain
 * Element = Fire (day) or Ice (night/underground)
 *
 * @param state - Current game state
 * @param playerIndex - Index of the player in state.players
 * @param player - The player resolving the effect
 * @param _effect - The terrain-based block effect (unused, but kept for API consistency)
 * @returns Resolution result with updated state
 */
export function resolveTerrainBasedBlock(
  state: GameState,
  playerIndex: number,
  player: Player,
  _effect: TerrainBasedBlockEffect
): EffectResolutionResult {
  const blockAmount = getUnmodifiedTerrainCost(state, player);
  const element = isNightLikeConditions(state) ? ELEMENT_ICE : ELEMENT_FIRE;

  // Create a standard GainBlockEffect and delegate to the atomic resolver
  const blockEffect: GainBlockEffect = {
    type: EFFECT_GAIN_BLOCK,
    amount: blockAmount,
    element,
  };

  const result = applyGainBlock(state, playerIndex, player, blockEffect);

  // Enhance description to clarify it's terrain-based
  return {
    ...result,
    description: `Gained ${blockAmount} ${element} Block (terrain cost)`,
  };
}
