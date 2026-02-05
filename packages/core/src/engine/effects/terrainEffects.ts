/**
 * Terrain-based effect resolvers
 *
 * Handles effects that depend on the terrain the player is currently on.
 * - TerrainBasedBlock: Block value equals terrain's unmodified movement cost,
 *   with Fire element during day and Ice element at night/underground.
 * - SelectHexForCostReduction: Sets pending hex selection for cost reduction.
 * - SelectTerrainForCostReduction: Sets pending terrain type selection for cost reduction.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type {
  TerrainBasedBlockEffect,
  GainBlockEffect,
  SelectHexForCostReductionEffect,
  SelectTerrainForCostReductionEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { applyGainBlock } from "./atomicEffects.js";
import { updatePlayer } from "./atomicHelpers.js";
import {
  hexKey,
  DEFAULT_MOVEMENT_COSTS,
  TIME_OF_DAY_NIGHT,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  TERRAIN_LAKE,
  TERRAIN_MOUNTAIN,
  TERRAIN_OCEAN,
  TERRAIN_PLAINS,
  TERRAIN_HILLS,
  TERRAIN_FOREST,
  TERRAIN_WASTELAND,
  TERRAIN_DESERT,
  TERRAIN_SWAMP,
  type HexCoord,
} from "@mage-knight/shared";
import {
  EFFECT_GAIN_BLOCK,
  EFFECT_TERRAIN_BASED_BLOCK,
  EFFECT_SELECT_HEX_FOR_COST_REDUCTION,
  EFFECT_SELECT_TERRAIN_FOR_COST_REDUCTION,
} from "../../types/effectTypes.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";

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

// ============================================================================
// TERRAIN COST REDUCTION SELECTION EFFECTS
// ============================================================================

/** All terrain types available for cost reduction selection */
const ALL_TERRAIN_TYPES = [
  TERRAIN_PLAINS,
  TERRAIN_HILLS,
  TERRAIN_FOREST,
  TERRAIN_WASTELAND,
  TERRAIN_DESERT,
  TERRAIN_SWAMP,
  TERRAIN_LAKE,
  TERRAIN_MOUNTAIN,
];

/**
 * Get all hex coordinates from the map (for hex cost reduction selection).
 * Returns all hexes on the revealed map, excluding the player's current position.
 */
function getAllMapHexCoords(state: GameState, excludeCoord?: HexCoord): HexCoord[] {
  const coords: HexCoord[] = [];
  for (const hex of Object.values(state.map.hexes)) {
    if (excludeCoord && hex.coord.q === excludeCoord.q && hex.coord.r === excludeCoord.r) {
      continue;
    }
    coords.push(hex.coord);
  }
  return coords;
}

/**
 * Resolve select hex for cost reduction effect.
 * Sets pendingTerrainCostReduction in "hex" mode with all map hexes as options.
 */
export function resolveSelectHexForCostReduction(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: SelectHexForCostReductionEffect
): EffectResolutionResult {
  const availableCoordinates = getAllMapHexCoords(state, player.position ?? undefined);

  const updatedPlayer = {
    ...player,
    pendingTerrainCostReduction: {
      mode: "hex" as const,
      availableCoordinates,
      availableTerrains: [] as readonly string[],
      reduction: effect.reduction,
      minimumCost: effect.minimumCost,
    },
  };

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: "Select a hex for terrain cost reduction",
  };
}

/**
 * Resolve select terrain for cost reduction effect.
 * Sets pendingTerrainCostReduction in "terrain" mode with all terrain types as options.
 */
export function resolveSelectTerrainForCostReduction(
  state: GameState,
  playerIndex: number,
  player: Player,
  _effect: SelectTerrainForCostReductionEffect
): EffectResolutionResult {
  const updatedPlayer = {
    ...player,
    pendingTerrainCostReduction: {
      mode: "terrain" as const,
      availableCoordinates: [] as readonly HexCoord[],
      availableTerrains: ALL_TERRAIN_TYPES,
      reduction: _effect.reduction,
      minimumCost: _effect.minimumCost,
    },
  };

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: "Select a terrain type for cost reduction",
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register all terrain-based effect handlers with the effect registry.
 * Called during effect system initialization.
 */
export function registerTerrainEffects(): void {
  registerEffect(EFFECT_TERRAIN_BASED_BLOCK, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return resolveTerrainBasedBlock(state, playerIndex, player, effect as TerrainBasedBlockEffect);
  });

  registerEffect(EFFECT_SELECT_HEX_FOR_COST_REDUCTION, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return resolveSelectHexForCostReduction(
      state, playerIndex, player, effect as SelectHexForCostReductionEffect
    );
  });

  registerEffect(EFFECT_SELECT_TERRAIN_FOR_COST_REDUCTION, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return resolveSelectTerrainForCostReduction(
      state, playerIndex, player, effect as SelectTerrainForCostReductionEffect
    );
  });
}
