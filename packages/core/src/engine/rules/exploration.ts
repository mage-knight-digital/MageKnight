/**
 * Shared exploration rules.
 *
 * Single source of truth for exploration distance/edge eligibility so
 * validActions and validators stay in sync.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import { isNearEdge } from "../explore/index.js";
import { isRuleActive } from "../modifiers/index.js";
import { RULE_EXTENDED_EXPLORE, RULE_SPACE_BENDING_ADJACENCY } from "../../types/modifierConstants.js";

/**
 * Effective exploration distance:
 * - 1 by default
 * - 2 when extended explore or space-bending adjacency is active
 */
export function getExploreDistance(state: GameState, playerId: string): number {
  const extendedExplore = isRuleActive(state, playerId, RULE_EXTENDED_EXPLORE);
  const spaceBending = isRuleActive(state, playerId, RULE_SPACE_BENDING_ADJACENCY);
  return (extendedExplore || spaceBending) ? 2 : 1;
}

/**
 * Whether the player is close enough to map edge to explore with current distance rules.
 */
export function isPlayerNearExploreEdge(state: GameState, player: Player): boolean {
  if (!player.position) {
    return false;
  }
  const exploreDistance = getExploreDistance(state, player.id);
  return isNearEdge(state, player.position, exploreDistance);
}

