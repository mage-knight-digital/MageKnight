/**
 * Shared tactic activation rules.
 *
 * These helpers are used by both command validation and ValidActions
 * computation to prevent rule drift.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { TacticId } from "@mage-knight/shared";
import {
  TACTIC_THE_RIGHT_MOMENT,
  TACTIC_LONG_NIGHT,
  TACTIC_MIDNIGHT_MEDITATION,
  TACTIC_SPARING_POWER,
} from "@mage-knight/shared";

/**
 * The Right Moment (Day 6):
 * Can be used any time during your turn except the final turn of the round.
 */
export function canActivateTheRightMoment(state: GameState): boolean {
  return state.endOfRoundAnnouncedBy === null && !state.scenarioEndTriggered;
}

/**
 * Long Night (Night 2):
 * Can be used when deck is empty and discard has at least one card.
 */
export function canActivateLongNight(player: Player): boolean {
  return player.deck.length === 0 && player.discard.length > 0;
}

/**
 * Midnight Meditation (Night 4):
 * Can be used at turn start (before action/movement) and only if hand is non-empty.
 */
export function canActivateMidnightMeditation(player: Player): boolean {
  return !player.hasTakenActionThisTurn && !player.hasMovedThisTurn && player.hand.length > 0;
}

/**
 * Midnight Meditation pending decision can only be resolved at turn start,
 * before any action or movement has occurred.
 */
export function canResolveMidnightMeditation(player: Player): boolean {
  return !player.hasTakenActionThisTurn && !player.hasMovedThisTurn;
}

/**
 * Whether the player's current pending tactic decision is still valid.
 *
 * Most decisions remain valid once created. Midnight Meditation is special:
 * it expires once the player starts their turn (action or movement).
 */
export function isPendingTacticDecisionStillValid(
  _state: GameState,
  player: Player
): boolean {
  const pending = player.pendingTacticDecision;
  if (!pending) {
    return false;
  }

  if (pending.type === TACTIC_MIDNIGHT_MEDITATION) {
    return canResolveMidnightMeditation(player);
  }

  return true;
}

/**
 * Check if a pending tactic decision should block all other actions.
 *
 * Some tactic decisions must be resolved before the turn can proceed:
 * - Sparing Power: "Once before the start of each turn" - must be resolved first
 *
 * Returns true if the pending decision gates all other actions.
 */
export function doesPendingTacticDecisionBlockActions(player: Player): boolean {
  const pending = player.pendingTacticDecision;
  if (!pending) {
    return false;
  }

  // Sparing Power is a "before turn" decision - blocks all other actions
  if (pending.type === TACTIC_SPARING_POWER) {
    return true;
  }

  // Other tactic decisions (Rethink, Mana Steal, etc.) do not block actions
  return false;
}

/**
 * Get tactic-specific activation failure reason.
 *
 * Returns null if tactic-specific requirements are satisfied.
 */
export function getTacticActivationFailureReason(
  state: GameState,
  player: Player,
  tacticId: TacticId
): string | null {
  if (tacticId === TACTIC_THE_RIGHT_MOMENT) {
    if (!canActivateTheRightMoment(state)) {
      return "Cannot use The Right Moment on the last turn of the round";
    }
  }

  if (tacticId === TACTIC_LONG_NIGHT) {
    if (!canActivateLongNight(player)) {
      if (player.deck.length > 0) {
        return "Cannot use Long Night when deck is not empty";
      }
      return "Cannot use Long Night when discard pile is empty";
    }
  }

  if (tacticId === TACTIC_MIDNIGHT_MEDITATION) {
    if (!canActivateMidnightMeditation(player)) {
      if (player.hasTakenActionThisTurn || player.hasMovedThisTurn) {
        return "Cannot use Midnight Meditation after starting your turn";
      }
      return "Cannot use Midnight Meditation when hand is empty";
    }
  }

  return null;
}
