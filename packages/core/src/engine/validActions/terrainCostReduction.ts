/**
 * Terrain cost reduction valid actions.
 *
 * Computes valid options for when a player is in a pending terrain cost reduction state
 * (e.g., from Druidic Paths card effect). Player must choose either a hex coordinate
 * (for hex-based reduction) or a terrain type (for terrain-based reduction).
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type {
  HexCostReductionOptions,
  TerrainCostReductionOptions,
} from "@mage-knight/shared";
import {
  TERRAIN_PLAINS,
  TERRAIN_HILLS,
  TERRAIN_FOREST,
  TERRAIN_WASTELAND,
  TERRAIN_DESERT,
  TERRAIN_SWAMP,
  TERRAIN_LAKE,
  TERRAIN_MOUNTAIN,
} from "@mage-knight/shared";

// All valid terrain types (mountain and ocean are not reachable via normal movement)
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
 * Get hex cost reduction valid actions for the player.
 *
 * Returns available coordinates where the player can apply hex-based cost reduction
 * (e.g., "reduce cost to enter this specific hex by 1").
 *
 * Implementation: Returns all hexes currently reachable with remaining move points
 * (Option A from spec), allowing the player to decide how to spend their move.
 */
export function getHexCostReductionValidActions(
  state: GameState,
  player: Player
): HexCostReductionOptions | null {
  // Check if player has pending hex cost reduction state
  if (
    !player.pendingTerrainCostReduction ||
    player.pendingTerrainCostReduction.mode !== "hex"
  ) {
    return null;
  }

  // Return the available coordinates from the pending state
  return {
    availableCoordinates: player.pendingTerrainCostReduction.availableCoordinates,
    reduction: player.pendingTerrainCostReduction.reduction,
    minimumCost: player.pendingTerrainCostReduction.minimumCost,
  };
}

/**
 * Get terrain cost reduction valid actions for the player.
 *
 * Returns available terrain types that can receive cost reduction
 * (e.g., "reduce all forest terrain costs by 1").
 *
 * Implementation: Returns all terrain types, since the player chooses which
 * terrain type to apply the reduction to for the rest of the game.
 */
export function getTerrainCostReductionValidActions(
  state: GameState,
  player: Player
): TerrainCostReductionOptions | null {
  // Check if player has pending terrain cost reduction state
  if (
    !player.pendingTerrainCostReduction ||
    player.pendingTerrainCostReduction.mode !== "terrain"
  ) {
    return null;
  }

  // Return all terrain types as available options
  return {
    availableTerrains: ALL_TERRAIN_TYPES,
    reduction: player.pendingTerrainCostReduction.reduction,
    minimumCost: player.pendingTerrainCostReduction.minimumCost,
  };
}
