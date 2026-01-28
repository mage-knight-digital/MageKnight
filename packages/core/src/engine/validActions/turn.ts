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
import { getBasicActionCard } from "../../data/basicActions/index.js";
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
  const canDeclareRest = checkCanDeclareRest(state, player);
  const canCompleteRest = checkCanCompleteRest(state, player);

  return {
    canEndTurn: checkCanEndTurn(state, player),
    canAnnounceEndOfRound: checkCanAnnounceEndOfRound(state, player),
    canUndo: canUndo(state.commandStack),
    canRest: canDeclareRest, // Legacy field - maps to canDeclareRest
    restTypes: getAvailableRestTypes(player),
    canDeclareRest,
    canCompleteRest,
    isResting: player.isResting,
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

  // Can't end turn with pending glade wound choice
  if (player.pendingGladeWoundChoice) {
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
 * Check if player can declare rest (enter resting state).
 * Requirements:
 * - Not already resting
 * - Not in combat
 * - Has cards in hand
 * - Hasn't taken an action yet this turn
 * - Hasn't moved this turn (rest replaces entire turn, not just action phase)
 */
function checkCanDeclareRest(state: GameState, player: Player): boolean {
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
 * Requirements:
 * - Currently in resting state
 * - Has cards in hand to discard
 */
function checkCanCompleteRest(_state: GameState, player: Player): boolean {
  // Must be resting to complete
  if (!player.isResting) {
    return false;
  }

  // Need cards to discard (or can complete with 0 if all wounds were healed)
  // Actually, per the rules, you can complete rest even if you played all non-wounds
  // and healed all wounds during rest - FAQ Q2 A2
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
