/**
 * Training Effect Handler
 *
 * Handles the EFFECT_TRAINING effect:
 * - Basic: Throw away an action card from hand, gain AA of same color from offer to discard pile.
 * - Powered: Throw away an action card from hand, gain AA of same color from offer to hand.
 *
 * Only action cards (basic or advanced) can be thrown away (not wounds, artifacts, spells).
 * The Training card itself cannot be thrown away.
 *
 * @module effects/trainingEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { Player, PendingTraining } from "../../types/player.js";
import type { TrainingEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { CardId } from "@mage-knight/shared";
import { CARD_WOUND } from "@mage-knight/shared";
import { updatePlayer } from "./atomicHelpers.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { EFFECT_TRAINING } from "../../types/effectTypes.js";
import { getActionCardColor } from "../helpers/cardColor.js";

// ============================================================================
// ELIGIBILITY HELPERS
// ============================================================================

/**
 * Get cards eligible for Training (action cards in hand, excluding
 * wounds and the source Training card itself).
 *
 * Additionally, a card's color must match at least one AA in the offer
 * for it to be eligible. However, this offer-matching check is NOT done
 * here — it is handled during phase 1 resolution after the card is selected.
 * This function only checks hand eligibility.
 */
export function getCardsEligibleForTraining(
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
 * Handle the EFFECT_TRAINING effect.
 *
 * Creates a pendingTraining state on the player, blocking other actions
 * until the player resolves it via RESOLVE_TRAINING action.
 */
export function handleTrainingEffect(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: TrainingEffect,
  sourceCardId: CardId | null
): EffectResolutionResult {
  if (!sourceCardId) {
    throw new Error("TrainingEffect requires sourceCardId");
  }

  const eligibleCards = getCardsEligibleForTraining(player.hand, sourceCardId);

  // If no action cards available, the effect cannot resolve
  if (eligibleCards.length === 0) {
    throw new Error("No action cards available to throw away for Training");
  }

  // Create pending state for card selection (phase 1)
  const pending: PendingTraining = {
    sourceCardId,
    mode: effect.mode,
    phase: "select_card",
    thrownCardColor: null,
    availableOfferCards: [],
  };

  const updatedPlayer: Player = {
    ...player,
    pendingTraining: pending,
  };

  const updatedState = updatePlayer(state, playerIndex, updatedPlayer);

  return {
    state: updatedState,
    description: `Training (${effect.mode}) requires throwing away an action card`,
    requiresChoice: true,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register Training effect handler with the effect registry.
 */
export function registerTrainingEffects(): void {
  registerEffect(
    EFFECT_TRAINING,
    (state, playerId, effect, sourceCardId) => {
      const { playerIndex, player } = getPlayerContext(state, playerId);
      return handleTrainingEffect(
        state,
        playerIndex,
        player,
        effect as TrainingEffect,
        (sourceCardId as CardId | undefined) ?? null
      );
    }
  );
}
