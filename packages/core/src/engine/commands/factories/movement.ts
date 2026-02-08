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
import { getEffectiveTerrainCost, isRuleActive } from "../../modifiers/index.js";
import { getPlayerById } from "../../helpers/playerHelpers.js";
import { RULE_GARRISON_REVEAL_DISTANCE_2 } from "../../../types/modifierConstants.js";

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
 * Get all hex coordinates within a given distance from the center (excluding center).
 */
function getHexCoordsWithinDistance(center: HexCoord, maxDistance: number): HexCoord[] {
  const coords: HexCoord[] = [];
  for (let dq = -maxDistance; dq <= maxDistance; dq++) {
    for (let dr = Math.max(-maxDistance, -dq - maxDistance); dr <= Math.min(maxDistance, -dq + maxDistance); dr++) {
      if (dq === 0 && dr === 0) continue;
      coords.push({ q: center.q + dq, r: center.r + dr });
    }
  }
  return coords;
}

/**
 * Check if moving from one hex to another would reveal unrevealed enemies.
 * Only applies during Day, when moving within reveal range of fortified sites.
 * Hawk Eyes extends reveal range to distance 2.
 */
function checkWouldRevealEnemies(
  state: GameState,
  playerId: string,
  from: HexCoord,
  to: HexCoord
): boolean {
  // Only reveal during Day
  if (state.timeOfDay !== TIME_OF_DAY_DAY) return false;

  const revealDistance = isRuleActive(state, playerId, RULE_GARRISON_REVEAL_DISTANCE_2) ? 2 : 1;

  const toNearby = revealDistance === 1
    ? getAllNeighbors(to)
    : getHexCoordsWithinDistance(to, revealDistance);

  const fromNearbyKeys = new Set(
    (revealDistance === 1
      ? getAllNeighbors(from)
      : getHexCoordsWithinDistance(from, revealDistance)
    ).map(hexKey)
  );

  for (const neighbor of toNearby) {
    const key = hexKey(neighbor);
    // Skip hexes already within range of 'from' position
    if (fromNearbyKeys.has(key)) continue;

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

  const terrainCost = getEffectiveTerrainCost(state, hex.terrain, playerId, target);

  // Check if this move would reveal hidden enemies
  const wouldRevealEnemies = checkWouldRevealEnemies(
    state,
    playerId,
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
