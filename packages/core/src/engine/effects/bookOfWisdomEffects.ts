/**
 * Book of Wisdom Effect Handler
 *
 * Handles the EFFECT_BOOK_OF_WISDOM effect:
 * - Basic: Throw away an action card from hand, gain Advanced Action of same color from offer to hand.
 * - Powered: Throw away an action card, gain Spell of same color to hand + crystal of that color.
 *
 * Only action cards (basic or advanced) can be thrown away (not wounds, artifacts, spells).
 * The Book of Wisdom card itself cannot be thrown away.
 *
 * @module effects/bookOfWisdomEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { Player, PendingBookOfWisdom } from "../../types/player.js";
import type { BookOfWisdomEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { CardId } from "@mage-knight/shared";
import { CARD_WOUND } from "@mage-knight/shared";
import { updatePlayer } from "./atomicHelpers.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { EFFECT_BOOK_OF_WISDOM } from "../../types/effectTypes.js";
import { getActionCardColor } from "../helpers/cardColor.js";

// ============================================================================
// ELIGIBILITY HELPERS
// ============================================================================

/**
 * Get cards eligible for Book of Wisdom (action cards in hand, excluding
 * wounds and the source Book of Wisdom card itself).
 */
export function getCardsEligibleForBookOfWisdom(
  hand: readonly CardId[],
  sourceCardId: CardId
): CardId[] {
  return hand.filter((cardId) => {
    if (cardId === CARD_WOUND) return false;
    if (cardId === sourceCardId) return false;
    // Only action cards (those with a color) can be thrown away
    return getActionCardColor(cardId) !== null;
  });
}

// ============================================================================
// EFFECT HANDLER
// ============================================================================

/**
 * Handle the EFFECT_BOOK_OF_WISDOM effect.
 *
 * Creates a pendingBookOfWisdom state on the player, blocking other actions
 * until the player resolves it via RESOLVE_BOOK_OF_WISDOM action.
 */
export function handleBookOfWisdomEffect(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: BookOfWisdomEffect,
  sourceCardId: CardId | null
): EffectResolutionResult {
  if (!sourceCardId) {
    throw new Error("BookOfWisdomEffect requires sourceCardId");
  }

  const eligibleCards = getCardsEligibleForBookOfWisdom(player.hand, sourceCardId);

  // If no action cards available, the effect cannot resolve
  if (eligibleCards.length === 0) {
    throw new Error("No action cards available to throw away for Book of Wisdom");
  }

  // Create pending state for card selection (phase 1)
  const pending: PendingBookOfWisdom = {
    sourceCardId,
    mode: effect.mode,
    phase: "select_card",
    thrownCardColor: null,
    availableOfferCards: [],
  };

  const updatedPlayer: Player = {
    ...player,
    pendingBookOfWisdom: pending,
  };

  const updatedState = updatePlayer(state, playerIndex, updatedPlayer);

  return {
    state: updatedState,
    description: `Book of Wisdom (${effect.mode}) requires throwing away an action card`,
    requiresChoice: true,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register Book of Wisdom effect handler with the effect registry.
 */
export function registerBookOfWisdomEffects(): void {
  registerEffect(
    EFFECT_BOOK_OF_WISDOM,
    (state, playerId, effect, sourceCardId) => {
      const { playerIndex, player } = getPlayerContext(state, playerId);
      return handleBookOfWisdomEffect(
        state,
        playerIndex,
        player,
        effect as BookOfWisdomEffect,
        (sourceCardId as CardId | undefined) ?? null
      );
    }
  );
}
