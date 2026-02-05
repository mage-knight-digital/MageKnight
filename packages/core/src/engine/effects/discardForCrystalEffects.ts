/**
 * Discard-for-Crystal Effect Handlers
 *
 * Handles the discard-for-crystal effect used by Krang's Savage Harvesting card:
 * - Discard one card to gain a crystal
 * - Action cards: crystal matches card color automatically
 * - Artifacts: player chooses which crystal color to gain
 *
 * @module effects/discardForCrystalEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { Player, PendingDiscardForCrystal } from "../../types/player.js";
import type { DiscardForCrystalEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { CardId } from "@mage-knight/shared";
import { CARD_WOUND } from "@mage-knight/shared";
import { updatePlayer } from "./atomicHelpers.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { EFFECT_DISCARD_FOR_CRYSTAL } from "../../types/effectTypes.js";

// ============================================================================
// ELIGIBILITY HELPERS
// ============================================================================

/**
 * Get cards eligible for discard-for-crystal (non-wound cards in hand).
 * Both action cards and artifacts are eligible.
 */
export function getCardsEligibleForDiscardForCrystal(
  hand: readonly CardId[]
): CardId[] {
  return hand.filter((cardId) => cardId !== CARD_WOUND);
}

// ============================================================================
// EFFECT HANDLER
// ============================================================================

/**
 * Handle the EFFECT_DISCARD_FOR_CRYSTAL effect.
 *
 * Creates a pendingDiscardForCrystal state on the player, blocking other actions
 * until the player resolves it via RESOLVE_DISCARD_FOR_CRYSTAL action.
 *
 * Resolution flow:
 * 1. Player selects a card to discard (or skips if optional)
 * 2a. If action card: automatically gain crystal of matching color
 * 2b. If artifact: present color choice, wait for RESOLVE_ARTIFACT_CRYSTAL_COLOR
 */
export function handleDiscardForCrystalEffect(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: DiscardForCrystalEffect,
  sourceCardId: CardId | null
): EffectResolutionResult {
  if (!sourceCardId) {
    throw new Error("DiscardForCrystalEffect requires sourceCardId");
  }

  const eligibleCards = getCardsEligibleForDiscardForCrystal(player.hand);

  // If no cards available and not optional, this is an error in card design
  // (Savage Harvesting is always optional, so this shouldn't happen in practice)
  if (eligibleCards.length === 0 && !effect.optional) {
    throw new Error("No cards available to discard for crystal");
  }

  // If no cards available and optional, skip this effect entirely
  if (eligibleCards.length === 0) {
    return {
      state,
      description: "No cards available to discard for crystal (skipped)",
    };
  }

  // Create pending state for card selection
  const pending: PendingDiscardForCrystal = {
    sourceCardId,
    optional: effect.optional,
    discardedCardId: null,
    awaitingColorChoice: false,
  };

  const updatedPlayer: Player = {
    ...player,
    pendingDiscardForCrystal: pending,
  };

  const updatedState = updatePlayer(state, playerIndex, updatedPlayer);

  return {
    state: updatedState,
    description: effect.optional
      ? `${sourceCardId} allows optionally discarding a card for a crystal`
      : `${sourceCardId} requires discarding a card for a crystal`,
    requiresChoice: true, // Blocks further resolution until player selects
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register discard-for-crystal effect handler with the effect registry.
 * Called during effect system initialization.
 */
export function registerDiscardForCrystalEffects(): void {
  registerEffect(
    EFFECT_DISCARD_FOR_CRYSTAL,
    (state, playerId, effect, sourceCardId) => {
      const { playerIndex, player } = getPlayerContext(state, playerId);
      return handleDiscardForCrystalEffect(
        state,
        playerIndex,
        player,
        effect as DiscardForCrystalEffect,
        (sourceCardId as CardId | undefined) ?? null
      );
    }
  );
}
