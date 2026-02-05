/**
 * Cure spell helper functions
 *
 * Query functions for checking if Cure's turn-scoped modifier is active.
 * Used by healing effect handlers to trigger additional card draws and unit readying.
 */

import type { GameState } from "../../state/GameState.js";
import { EFFECT_CURE_ACTIVE } from "../../types/modifierConstants.js";
import { getModifiersForPlayer } from "../modifiers/queries.js";

/**
 * Check if the Cure spell's active modifier is present for a player.
 * When true, healing from hand should also draw cards,
 * and unit healing should also ready the unit.
 */
export function isCureActive(state: GameState, playerId: string): boolean {
  const modifiers = getModifiersForPlayer(state, playerId);
  return modifiers.some((m) => m.effect.type === EFFECT_CURE_ACTIVE);
}
