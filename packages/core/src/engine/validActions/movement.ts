/**
 * Movement action options.
 *
 * Computes valid hex targets a player can move to, with terrain costs.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { MoveOptions, MoveTarget } from "@mage-knight/shared";
import { HEX_DIRECTIONS, hexKey, getNeighbor } from "@mage-knight/shared";
import { getEffectiveTerrainCost } from "../modifiers.js";
import { SiteType } from "../../types/map.js";

/**
 * Get valid move targets for a player.
 *
 * Returns adjacent hexes that the player can move to, with costs.
 * Checks:
 * - Hex exists on map
 * - Terrain is passable (cost < Infinity)
 * - Player has enough move points
 * - No blocking rampaging enemies
 * - Scenario rules (city entry)
 */
export function getValidMoveTargets(
  state: GameState,
  player: Player
): MoveOptions | undefined {
  // Must be on the map
  if (!player.position) {
    return undefined;
  }

  // Can't move after taking an action
  if (player.hasTakenActionThisTurn) {
    return undefined;
  }

  const targets: MoveTarget[] = [];

  // Check each adjacent hex
  for (const dir of HEX_DIRECTIONS) {
    const adjacent = getNeighbor(player.position, dir);
    const key = hexKey(adjacent);
    const hex = state.map.hexes[key];

    // Skip if hex doesn't exist
    if (!hex) continue;

    // Get terrain cost (may be modified by skills/cards)
    const cost = getEffectiveTerrainCost(state, hex.terrain, player.id);

    // Skip impassable terrain
    if (cost === Infinity) continue;

    // Skip if not enough move points
    if (player.movePoints < cost) continue;

    // Skip if blocked by rampaging enemies
    if (hex.rampagingEnemies.length > 0 && hex.enemies.length > 0) continue;

    // Skip cities if scenario doesn't allow entry
    if (hex.site?.type === SiteType.City) {
      if (!state.scenarioConfig.citiesCanBeEntered) continue;
    }

    targets.push({
      hex: adjacent,
      cost,
    });
  }

  // Return undefined if no valid targets
  if (targets.length === 0) {
    return undefined;
  }

  return { targets };
}
