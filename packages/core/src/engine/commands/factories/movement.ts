/**
 * Movement Command Factories
 *
 * Factory functions that translate movement-related PlayerAction objects
 * into executable Command objects.
 *
 * @module commands/factories/movement
 *
 * @remarks Factories in this module:
 * - createMoveCommandFromAction - Move player to adjacent hex
 * - createExploreCommandFromAction - Explore and reveal new tile
 */

import type { CommandFactory } from "./types.js";
import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction, HexCoord } from "@mage-knight/shared";
import {
  MOVE_ACTION,
  EXPLORE_ACTION,
  hexKey,
  getAllNeighbors,
  TIME_OF_DAY_DAY,
} from "@mage-knight/shared";
import { SITE_PROPERTIES } from "../../../data/siteProperties.js";
import { createMoveCommand } from "../moveCommand.js";
import { createExploreCommand } from "../exploreCommand.js";
import { getEffectiveTerrainCost } from "../../modifiers.js";
import { getPlayerById } from "../../helpers/playerHelpers.js";

/**
 * Helper to get move target from action.
 */
function getMoveTarget(action: PlayerAction): HexCoord | null {
  if (action.type === MOVE_ACTION && "target" in action) {
    return action.target;
  }
  return null;
}

/**
 * Check if moving from one hex to another would reveal unrevealed enemies.
 * Only applies during Day, when moving adjacent to fortified sites.
 */
function checkWouldRevealEnemies(
  state: GameState,
  from: HexCoord,
  to: HexCoord
): boolean {
  // Only reveal during Day
  if (state.timeOfDay !== TIME_OF_DAY_DAY) return false;

  const fromNeighbors = new Set(getAllNeighbors(from).map(hexKey));
  const toNeighbors = getAllNeighbors(to);

  for (const neighbor of toNeighbors) {
    const key = hexKey(neighbor);
    // Skip hexes already adjacent to 'from' position
    if (fromNeighbors.has(key)) continue;

    const hex = state.map.hexes[key];
    if (!hex?.site) continue;

    // Check if it's a fortified site
    const props = SITE_PROPERTIES[hex.site.type];
    if (!props.fortified) continue;

    // Check if it has unrevealed enemies
    const hasUnrevealedEnemies = hex.enemies.some((e) => !e.isRevealed);
    if (hasUnrevealedEnemies) {
      return true;
    }
  }

  return false;
}

/**
 * Move command factory.
 * Creates a command to move the player to an adjacent hex.
 */
export const createMoveCommandFromAction: CommandFactory = (
  state,
  playerId,
  action
) => {
  const player = getPlayerById(state, playerId);
  const target = getMoveTarget(action);

  if (!player?.position || !target) return null;

  const hex = state.map.hexes[hexKey(target)];
  if (!hex) return null;

  const terrainCost = getEffectiveTerrainCost(state, hex.terrain, playerId);

  // Check if this move would reveal hidden enemies
  const wouldRevealEnemies = checkWouldRevealEnemies(
    state,
    player.position,
    target
  );

  return createMoveCommand({
    playerId,
    from: player.position,
    to: target,
    terrainCost,
    hadMovedThisTurn: player.hasMovedThisTurn,
    ...(wouldRevealEnemies && { wouldRevealEnemies: true }),
  });
};

/**
 * Explore command factory.
 * Creates a command to explore and reveal a new map tile.
 */
export const createExploreCommandFromAction: CommandFactory = (
  state,
  playerId,
  action
) => {
  if (action.type !== EXPLORE_ACTION) return null;

  const { direction, fromTileCoord } = action;
  if (!direction || !fromTileCoord) return null;

  const player = getPlayerById(state, playerId);
  if (!player?.position) return null;

  // Draw a tile (SIMPLE: take first from countryside, then core)
  const tileId =
    state.map.tileDeck.countryside[0] ?? state.map.tileDeck.core[0];
  if (!tileId) return null;

  return createExploreCommand({
    playerId,
    fromHex: fromTileCoord,
    direction,
    tileId,
  });
};
