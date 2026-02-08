/**
 * Decompose Effect Handlers
 *
 * Handles the Decompose advanced action card effect:
 * - Throw away an action card from hand (permanent removal)
 * - Basic: gain 2 crystals matching the thrown card's color
 * - Powered: gain 1 crystal of each basic color NOT matching the thrown card's color
 *
 * Only action cards (basic or advanced) can be thrown away.
 * Wounds, artifacts, spells, and the Decompose card itself are excluded.
 *
 * @module effects/decomposeEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { Player, PendingDecompose } from "../../types/player.js";
import type { DecomposeEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { CardId } from "@mage-knight/shared";
import { CARD_WOUND } from "@mage-knight/shared";
import { updatePlayer } from "./atomicHelpers.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { EFFECT_DECOMPOSE } from "../../types/effectTypes.js";
import { getActionCardColor } from "../helpers/cardColor.js";

// ============================================================================
// ELIGIBILITY HELPERS
// ============================================================================

/**
 * Get cards eligible for Decompose (action cards in hand, excluding
 * wounds and the source Decompose card itself).
 */
export function getCardsEligibleForDecompose(
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
 * Handle the EFFECT_DECOMPOSE effect.
 *
 * Creates a pendingDecompose state on the player, blocking other actions
 * until the player resolves it via RESOLVE_DECOMPOSE action.
 */
export function handleDecomposeEffect(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: DecomposeEffect,
  sourceCardId: CardId | null
): EffectResolutionResult {
  if (!sourceCardId) {
    throw new Error("DecomposeEffect requires sourceCardId");
  }

  const eligibleCards = getCardsEligibleForDecompose(player.hand, sourceCardId);

  // If no action cards available, the effect cannot resolve
  if (eligibleCards.length === 0) {
    throw new Error("No action cards available to throw away for Decompose");
  }

  // Create pending state for card selection
  const pending: PendingDecompose = {
    sourceCardId,
    mode: effect.mode,
  };

  const updatedPlayer: Player = {
    ...player,
    pendingDecompose: pending,
  };

  const updatedState = updatePlayer(state, playerIndex, updatedPlayer);

  return {
    state: updatedState,
    description: `Decompose (${effect.mode}) requires throwing away an action card`,
    requiresChoice: true, // Blocks further resolution until player selects
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register decompose effect handler with the effect registry.
 * Called during effect system initialization.
 */
export function registerDecomposeEffects(): void {
  registerEffect(
    EFFECT_DECOMPOSE,
    (state, playerId, effect, sourceCardId) => {
      const { playerIndex, player } = getPlayerContext(state, playerId);
      return handleDecomposeEffect(
        state,
        playerIndex,
        player,
        effect as DecomposeEffect,
        (sourceCardId as CardId | undefined) ?? null
      );
    }
  );
}
