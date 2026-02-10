/**
 * Shared turn and rest structure rules.
 *
 * These helpers are used by both validators and ValidActions computation
 * to prevent rule drift.
 */

import { getBasicActionCard } from "../../data/basicActions/index.js";
import { DEED_CARD_TYPE_WOUND } from "../../types/cards.js";
import type { BasicActionCardId, RestType } from "@mage-knight/shared";
import { REST_TYPE_STANDARD, REST_TYPE_SLOW_RECOVERY } from "@mage-knight/shared";
import type { Player } from "../../types/player.js";
import type { GameState } from "../../state/GameState.js";

/**
 * Check if a card is a wound card.
 *
 * Wound cards are special deed cards that are drawn when damage is taken.
 * They are discarded during rest (Standard Rest or Slow Recovery).
 */
export function isWoundCard(cardId: string): boolean {
  try {
    const card = getBasicActionCard(cardId as BasicActionCardId);
    return card.cardType === DEED_CARD_TYPE_WOUND;
  } catch {
    // If card not found in basic actions, assume it's not a wound
    return false;
  }
}

/**
 * Get which rest types are available for a player.
 *
 * - Standard Rest: requires at least one non-wound card (discard 1 non-wound + any wounds)
 * - Slow Recovery: only when hand is ALL wounds (discard 1 wound)
 *
 * Returns undefined if no rest types are available (empty hand).
 */
export function getAvailableRestTypes(player: Player): RestType[] | undefined {
  if (player.hand.length === 0) {
    return undefined;
  }

  const hasNonWound = player.hand.some((cardId) => !isWoundCard(cardId));
  const allWounds = !hasNonWound;

  const types: RestType[] = [];

  // Standard rest requires at least one non-wound card
  if (hasNonWound) {
    types.push(REST_TYPE_STANDARD);
  }

  // Slow recovery only available when hand is all wounds
  if (allWounds) {
    types.push(REST_TYPE_SLOW_RECOVERY);
  }

  return types.length > 0 ? types : undefined;
}

/**
 * Check if player can declare rest (enter resting state).
 *
 * Requirements:
 * - Not already resting
 * - Not in combat
 * - Has cards in hand
 * - Hasn't taken an action yet this turn
 * - Hasn't moved this turn (rest replaces entire turn, not just action phase)
 */
export function canDeclareRest(state: GameState, player: Player): boolean {
  // Already resting
  if (player.isResting) {
    return false;
  }

  // Can't rest in combat
  if (state.combat !== null) {
    return false;
  }

  // Need cards to discard
  if (player.hand.length === 0) {
    return false;
  }

  // Can't declare rest if already taken an action
  if (player.hasTakenActionThisTurn) {
    return false;
  }

  // Can't rest after moving - rest replaces entire turn (no movement phase)
  if (player.hasMovedThisTurn) {
    return false;
  }

  return true;
}

/**
 * Check if player can complete rest (discard cards to finish resting).
 *
 * Requirements:
 * - Currently in resting state
 * - Has cards in hand to discard (or all wounds were healed during rest)
 */
export function canCompleteRest(player: Player): boolean {
  // Must be resting to complete
  if (!player.isResting) {
    return false;
  }

  // Can complete rest even if hand is empty (all wounds healed per FAQ Q2 A2)
  return true;
}

/**
 * Get which cards can be discarded for rest completion.
 *
 * Returns the set of discardable cards and metadata about the rest type:
 * - Standard Rest: can discard any card (will need exactly 1 non-wound + any wounds)
 * - Slow Recovery (wounds only): can only discard wounds (will need exactly 1)
 * - Slow Recovery (empty hand): all wounds healed, no discard needed
 */
export function getRestDiscardableCards(player: Player): {
  discardableCardIds: readonly string[];
  restType: RestType;
  allowEmptyDiscard: boolean;
} | null {
  if (!player.isResting) {
    return null;
  }

  const hasNonWoundInHand = player.hand.some((cardId) => !isWoundCard(cardId));

  if (hasNonWoundInHand) {
    // Standard Rest: can discard any card in hand
    return {
      discardableCardIds: player.hand,
      restType: REST_TYPE_STANDARD,
      allowEmptyDiscard: false,
    };
  } else if (player.hand.length === 0) {
    // Slow Recovery with empty hand (all wounds healed during rest)
    return {
      discardableCardIds: [],
      restType: REST_TYPE_SLOW_RECOVERY,
      allowEmptyDiscard: true,
    };
  } else {
    // Slow Recovery: only wounds in hand
    return {
      discardableCardIds: player.hand,
      restType: REST_TYPE_SLOW_RECOVERY,
      allowEmptyDiscard: false,
    };
  }
}

/**
 * Check if player can end their turn.
 *
 * Generally always possible unless there's pending state that needs resolution:
 * - Pending choice
 * - Pending tactic decision
 * - Pending glade wound choice
 * - Currently resting
 * - Pending level up rewards
 * - Pending site rewards
 * - Must play or discard at least one card from hand if any held
 */
export function canEndTurn(state: GameState, player: Player): boolean {
  // Can't end turn with pending choice
  if (player.pendingChoice !== null) {
    return false;
  }

  // Can't end turn with pending tactic decision (e.g., Mana Steal die selection)
  if (player.pendingTacticDecision !== null) {
    return false;
  }

  // Can't end turn with pending glade wound choice
  if (player.pendingGladeWoundChoice) {
    return false;
  }

  // Can't end turn while resting
  if (player.isResting) {
    return false;
  }

  // Can't end turn with pending level up rewards
  if (player.pendingLevelUpRewards.length > 0) {
    return false;
  }

  // Can't end turn with pending site rewards
  if (player.pendingRewards.length > 0) {
    return false;
  }

  // Must satisfy minimum turn requirement before ending turn.
  // This is waived when hand is empty or contains only wounds.
  if (!hasMetMinimumTurnRequirement(player)) {
    return false;
  }

  return true;
}

/**
 * Check if player has met the minimum turn requirement.
 *
 * Per rulebook Minimum Turn S1: "Every turn you must play at least one card from your hand.
 * Failing that, you must discard one unplayed card from your hand."
 *
 * Requirement is waived if player has no cards in hand.
 */
export function hasMetMinimumTurnRequirement(player: Player): boolean {
  // If player has no cards in hand, requirement is waived
  if (player.hand.length === 0) {
    return true;
  }

  // If player already played or discarded a card from hand, requirement is satisfied
  if (player.playedCardFromHandThisTurn) {
    return true;
  }

  // If hand contains only wounds, requirement is waived.
  // Wounds cannot be played and there is no generic "discard one card" action.
  if (player.hand.every((cardId) => isWoundCard(cardId))) {
    return true;
  }

  // Player has cards in hand but hasn't played or discarded
  return false;
}

/**
 * Check if player must announce end of round.
 *
 * Triggered when deck and hand are both empty and round end is not announced.
 */
export function mustAnnounceEndOfRoundAtTurnStart(
  state: GameState,
  player: Player
): boolean {
  return (
    state.endOfRoundAnnouncedBy === null &&
    player.deck.length === 0 &&
    player.hand.length === 0
  );
}

/**
 * Check if player must forfeit turn because round end was announced by another player.
 *
 * Triggered when the current player has no cards in deck or hand and cannot take actions.
 */
export function mustForfeitTurnAfterRoundAnnouncement(
  state: GameState,
  player: Player
): boolean {
  return (
    state.endOfRoundAnnouncedBy !== null &&
    state.endOfRoundAnnouncedBy !== player.id &&
    player.deck.length === 0 &&
    player.hand.length === 0
  );
}
