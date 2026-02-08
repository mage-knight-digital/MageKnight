/**
 * Maximal Effect Effect Handlers
 *
 * Handles the Maximal Effect advanced action card:
 * - Throw away an action card from hand (permanent removal)
 * - Basic: use target card's basic effect 3 times
 * - Powered: use target card's powered effect 2 times (for free)
 *
 * Only action cards (basic or advanced) can be thrown away.
 * Wounds, artifacts, spells, and the Maximal Effect card itself are excluded.
 *
 * @module effects/maximalEffectEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { Player, PendingMaximalEffect } from "../../types/player.js";
import type { MaximalEffectEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { CardId } from "@mage-knight/shared";
import { CARD_WOUND } from "@mage-knight/shared";
import { updatePlayer } from "./atomicHelpers.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { EFFECT_MAXIMAL_EFFECT } from "../../types/effectTypes.js";
import { getActionCardColor } from "../helpers/cardColor.js";

// ============================================================================
// ELIGIBILITY HELPERS
// ============================================================================

/**
 * Get cards eligible for Maximal Effect (action cards in hand, excluding
 * wounds and the source Maximal Effect card itself).
 *
 * Same eligibility as Decompose: only action cards (those with a color).
 */
export function getCardsEligibleForMaximalEffect(
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
 * Handle the EFFECT_MAXIMAL_EFFECT effect.
 *
 * Creates a pendingMaximalEffect state on the player, blocking other actions
 * until the player resolves it via RESOLVE_MAXIMAL_EFFECT action.
 */
export function handleMaximalEffectEffect(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: MaximalEffectEffect,
  sourceCardId: CardId | null
): EffectResolutionResult {
  if (!sourceCardId) {
    throw new Error("MaximalEffectEffect requires sourceCardId");
  }

  const eligibleCards = getCardsEligibleForMaximalEffect(player.hand, sourceCardId);

  // If no action cards available, the effect cannot resolve
  if (eligibleCards.length === 0) {
    throw new Error("No action cards available to throw away for Maximal Effect");
  }

  // Create pending state for card selection
  const pending: PendingMaximalEffect = {
    sourceCardId,
    multiplier: effect.multiplier,
    effectKind: effect.effectKind,
  };

  const updatedPlayer: Player = {
    ...player,
    pendingMaximalEffect: pending,
  };

  const updatedState = updatePlayer(state, playerIndex, updatedPlayer);

  return {
    state: updatedState,
    description: `Maximal Effect (${effect.effectKind} ×${effect.multiplier}) requires throwing away an action card`,
    requiresChoice: true, // Blocks further resolution until player selects
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register maximal effect handler with the effect registry.
 * Called during effect system initialization.
 */
export function registerMaximalEffectEffects(): void {
  registerEffect(
    EFFECT_MAXIMAL_EFFECT,
    (state, playerId, effect, sourceCardId) => {
      const { playerIndex, player } = getPlayerContext(state, playerId);
      return handleMaximalEffectEffect(
        state,
        playerIndex,
        player,
        effect as MaximalEffectEffect,
        (sourceCardId as CardId | undefined) ?? null
      );
    }
  );
}
