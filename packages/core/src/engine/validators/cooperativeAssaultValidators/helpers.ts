/**
 * Cooperative assault validator helpers
 *
 * Shared helper functions used by proposal, response, and cancel validators.
 */

import type { GameState } from "../../../state/GameState.js";
import type { CityColor as CoreCityColor } from "../../../types/map.js";
import { SiteType } from "../../../types/map.js";
import { CARD_WOUND, getAllNeighbors } from "@mage-knight/shared";
import { getPlayerById } from "../../helpers/playerHelpers.js";

/**
 * Find the hex coordinate of a city with the given color.
 */
export function findCityHex(
  state: GameState,
  cityColor: CoreCityColor
): { q: number; r: number } | null {
  for (const [, hex] of Object.entries(state.map.hexes)) {
    if (
      hex.site?.type === SiteType.City &&
      hex.site.cityColor === cityColor
    ) {
      return hex.coord;
    }
  }
  return null;
}

/**
 * Check if a position is adjacent to a city of the given color.
 */
export function isAdjacentToCity(
  state: GameState,
  position: { q: number; r: number },
  cityColor: CoreCityColor
): boolean {
  const cityHex = findCityHex(state, cityColor);
  if (!cityHex) return false;

  const neighbors = getAllNeighbors(position);
  return neighbors.some((n) => n.q === cityHex.q && n.r === cityHex.r);
}

/**
 * Check if a player has at least one non-wound card in hand.
 */
export function hasNonWoundCard(state: GameState, playerId: string): boolean {
  const player = getPlayerById(state, playerId);
  if (!player) return false;

  return player.hand.some((cardId) => cardId !== CARD_WOUND);
}
