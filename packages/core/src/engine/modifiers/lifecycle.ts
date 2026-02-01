/**
 * Modifier lifecycle management
 *
 * Functions for adding, removing, and expiring modifiers.
 * This module has no dependencies on other modifier modules.
 */

import type { GameState } from "../../state/GameState.js";
import type { ActiveModifier } from "../../types/modifiers.js";
import {
  DURATION_COMBAT,
  DURATION_ROUND,
  DURATION_TURN,
  DURATION_UNTIL_NEXT_TURN,
  EXPIRATION_COMBAT_END,
  EXPIRATION_ROUND_END,
  EXPIRATION_TURN_END,
  EXPIRATION_TURN_START,
} from "../modifierConstants.js";

/**
 * Add a modifier to game state (returns new state).
 */
export function addModifier(
  state: GameState,
  modifier: Omit<ActiveModifier, "id">
): GameState {
  const id = `mod_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const newModifier: ActiveModifier = { ...modifier, id };

  return {
    ...state,
    activeModifiers: [...state.activeModifiers, newModifier],
  };
}

/**
 * Remove a specific modifier by ID.
 */
export function removeModifier(
  state: GameState,
  modifierId: string
): GameState {
  return {
    ...state,
    activeModifiers: state.activeModifiers.filter((m) => m.id !== modifierId),
  };
}

// === Expiration ===

export type ExpirationTrigger =
  | { readonly type: typeof EXPIRATION_TURN_END; readonly playerId: string }
  | { readonly type: typeof EXPIRATION_COMBAT_END }
  | { readonly type: typeof EXPIRATION_ROUND_END }
  | { readonly type: typeof EXPIRATION_TURN_START; readonly playerId: string }; // for "until_next_turn" modifiers

/**
 * Expire modifiers based on a game event trigger.
 */
export function expireModifiers(
  state: GameState,
  trigger: ExpirationTrigger
): GameState {
  const remaining = state.activeModifiers.filter((m) => {
    switch (trigger.type) {
      case EXPIRATION_TURN_END:
        // Expire "turn" duration modifiers from this player
        if (
          m.duration === DURATION_TURN &&
          m.createdByPlayerId === trigger.playerId
        ) {
          return false;
        }
        return true;

      case EXPIRATION_COMBAT_END:
        return m.duration !== DURATION_COMBAT;

      case EXPIRATION_ROUND_END:
        return m.duration !== DURATION_ROUND;

      case EXPIRATION_TURN_START:
        // Expire "until_next_turn" modifiers when their creator's turn starts
        if (
          m.duration === DURATION_UNTIL_NEXT_TURN &&
          m.createdByPlayerId === trigger.playerId
        ) {
          return false;
        }
        return true;

      default:
        return true;
    }
  });

  return {
    ...state,
    activeModifiers: remaining,
  };
}
