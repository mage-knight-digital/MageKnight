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
 * Can be used before taking an action and only if hand is non-empty.
 */
export function canActivateMidnightMeditation(player: Player): boolean {
  return !player.hasTakenActionThisTurn && player.hand.length > 0;
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
      if (player.hasTakenActionThisTurn) {
        return "Cannot use Midnight Meditation after taking an action";
      }
      return "Cannot use Midnight Meditation when hand is empty";
    }
  }

  return null;
}
