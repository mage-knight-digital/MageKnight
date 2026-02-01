/**
 * Shared helpers for atomic effect handlers
 *
 * These utilities are used across multiple atomic effect modules
 * for common operations like updating player state and elemental values.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player, ElementalAttackValues } from "../../types/player.js";
import type { Element } from "@mage-knight/shared";
import { ELEMENT_FIRE, ELEMENT_ICE, ELEMENT_COLD_FIRE } from "@mage-knight/shared";

// ============================================================================
// PLAYER STATE HELPERS
// ============================================================================

/**
 * Update a player in the game state immutably.
 *
 * @param state - Current game state
 * @param playerIndex - Index of player to update
 * @param updatedPlayer - New player object
 * @returns New game state with updated player
 */
export function updatePlayer(
  state: GameState,
  playerIndex: number,
  updatedPlayer: Player
): GameState {
  const players = [...state.players];
  players[playerIndex] = updatedPlayer;
  return { ...state, players };
}

// ============================================================================
// ELEMENTAL VALUE HELPERS
// ============================================================================

/**
 * Update an elemental value (attack or block) for a specific element.
 *
 * Maps element types to their corresponding property in ElementalAttackValues:
 * - undefined or physical → physical
 * - fire → fire
 * - ice → ice
 * - cold_fire → coldFire
 *
 * @param values - Current elemental values
 * @param element - Element to update (undefined defaults to physical)
 * @param amount - Amount to add
 * @returns New elemental values with updated amount
 */
export function updateElementalValue(
  values: ElementalAttackValues,
  element: Element | undefined,
  amount: number
): ElementalAttackValues {
  if (!element) {
    return { ...values, physical: values.physical + amount };
  }
  switch (element) {
    case ELEMENT_FIRE:
      return { ...values, fire: values.fire + amount };
    case ELEMENT_ICE:
      return { ...values, ice: values.ice + amount };
    case ELEMENT_COLD_FIRE:
      return { ...values, coldFire: values.coldFire + amount };
    default:
      return { ...values, physical: values.physical + amount };
  }
}

/**
 * Map an Element type to its property key in ElementalAttackValues.
 *
 * Used by reverseEffect and other places that need to access
 * elemental values by element type.
 *
 * @param element - Element type (undefined defaults to physical)
 * @returns Property key for ElementalAttackValues
 */
export function elementToPropertyKey(
  element: Element | undefined
): keyof ElementalAttackValues {
  if (!element) return "physical";
  switch (element) {
    case ELEMENT_FIRE:
      return "fire";
    case ELEMENT_ICE:
      return "ice";
    case ELEMENT_COLD_FIRE:
      return "coldFire";
    default:
      return "physical";
  }
}
