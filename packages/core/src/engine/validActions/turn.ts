/**
 * Turn structure action options.
 *
 * Determines what turn-related actions are available:
 * - End turn
 * - Announce end of round
 * - Rest (standard / slow recovery)
 * - Undo
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { TurnOptions } from "@mage-knight/shared";
import { REST_TYPE_STANDARD, REST_TYPE_SLOW_RECOVERY } from "@mage-knight/shared";
import type { RestType } from "@mage-knight/shared";
import { canUndo } from "../commandStack.js";
import { getBasicActionCard } from "../../data/basicActions.js";
import { DEED_CARD_TYPE_WOUND } from "../../types/cards.js";
import type { BasicActionCardId } from "@mage-knight/shared";

/**
 * Check if a card is a wound
 */
function isWoundCard(cardId: string): boolean {
  try {
    const card = getBasicActionCard(cardId as BasicActionCardId);
    return card.cardType === DEED_CARD_TYPE_WOUND;
  } catch {
    return false;
  }
}

/**
 * Get available turn options for a player.
 */
export function getTurnOptions(state: GameState, player: Player): TurnOptions {
  return {
    canEndTurn: checkCanEndTurn(state, player),
    canAnnounceEndOfRound: checkCanAnnounceEndOfRound(state, player),
    canUndo: canUndo(state.commandStack),
    canRest: checkCanRest(state, player),
    restTypes: getAvailableRestTypes(player),
  };
}

/**
 * Check if player can end their turn.
 * Generally always possible unless there's a pending choice or pending tactic decision.
 */
function checkCanEndTurn(_state: GameState, player: Player): boolean {
  // Can't end turn with pending choice
  if (player.pendingChoice !== null) {
    return false;
  }

  // Can't end turn with pending tactic decision (e.g., Mana Steal die selection)
  if (player.pendingTacticDecision !== null) {
    return false;
  }

  return true;
}

/**
 * Check if player can announce end of round.
 * Requirements:
 * - Deck must be empty (or deck+hand empty for auto-announce)
 * - Round end not already announced
 */
function checkCanAnnounceEndOfRound(state: GameState, player: Player): boolean {
  // Already announced
  if (state.endOfRoundAnnouncedBy !== null) {
    return false;
  }

  // Must have empty deck to announce
  if (player.deck.length > 0) {
    return false;
  }

  return true;
}

/**
 * Check if player can rest at all.
 * Requirements:
 * - Has cards in hand to discard
 * - Not in combat
 */
function checkCanRest(state: GameState, player: Player): boolean {
  // Can't rest in combat
  if (state.combat !== null) {
    return false;
  }

  // Need cards to discard
  if (player.hand.length === 0) {
    return false;
  }

  return true;
}

/**
 * Get which rest types are available.
 * - Standard: requires at least one non-wound card
 * - Slow Recovery: only when hand is ALL wounds
 */
function getAvailableRestTypes(player: Player): RestType[] | undefined {
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
