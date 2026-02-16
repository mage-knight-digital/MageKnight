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
import { EFFECT_MAXIMAL_EFFECT, EFFECT_DISCARD_COST, EFFECT_DECOMPOSE, EFFECT_TRAINING } from "../../types/effectTypes.js";
import { getActionCardColor } from "../helpers/cardColor.js";
import { getCard } from "../helpers/cardLookup.js";
import { getCardsEligibleForDiscardCost } from "./discardEffects.js";
import type { CardEffectKind } from "../helpers/cardCategoryHelpers.js";
import type { DiscardCostEffect } from "../../types/cards.js";

// ============================================================================
// ELIGIBILITY HELPERS
// ============================================================================

/**
 * Get cards eligible for Maximal Effect (action cards in hand, excluding
 * wounds and the source Maximal Effect card itself).
 *
 * Same eligibility as Decompose: only action cards (those with a color).
 *
 * When effectKind and multiplier are provided, also filters out cards whose
 * effect requires a discard cost or throw-away cost that can't be fully paid.
 * Per the rules, you need enough cards to cover ALL copies (e.g., Maximal
 * Effect basic ×3 with Improvisation requires 3 discardable cards, and with
 * Decompose/Training requires 3 action cards to throw away).
 */
export function getCardsEligibleForMaximalEffect(
  hand: readonly CardId[],
  sourceCardId: CardId,
  effectKind?: CardEffectKind,
  multiplier?: number
): CardId[] {
  return hand.filter((cardId) => {
    if (cardId === CARD_WOUND) return false;
    if (cardId === sourceCardId) return false;
    // Only action cards (those with a color) can be thrown away
    if (getActionCardColor(cardId) === null) return false;

    // When effectKind is known, check that the effect's discard cost is payable
    // across all multiplied copies after the target card is removed from hand.
    // Rules: "you aren't allowed to play Maximal Effect with a card like
    // Improvisation if you don't have enough cards to complete the cost"
    if (effectKind) {
      const card = getCard(cardId);
      if (card) {
        const effect = effectKind === "basic" ? card.basicEffect : card.poweredEffect;
        if (effect.type === EFFECT_DISCARD_COST) {
          const discardEffect = effect as DiscardCostEffect;
          if (!discardEffect.optional) {
            // Simulate removing the target card from hand
            const handAfterThrow = [...hand];
            const idx = handAfterThrow.indexOf(cardId);
            if (idx !== -1) handAfterThrow.splice(idx, 1);

            const eligible = getCardsEligibleForDiscardCost(
              handAfterThrow,
              discardEffect.filterWounds ?? true,
              discardEffect.colorMatters ?? false,
              discardEffect.allowNoColor ?? false
            );

            const totalCost = discardEffect.count * (multiplier ?? 1);
            if (eligible.length < totalCost) {
              return false;
            }
          }
        }

        // Throw-away effects (Decompose, Training): each invocation requires
        // throwing away 1 action card from hand. With multiplier N, need N
        // action cards remaining after the target is removed.
        if (effect.type === EFFECT_DECOMPOSE || effect.type === EFFECT_TRAINING) {
          const handAfterThrow = [...hand];
          const idx = handAfterThrow.indexOf(cardId);
          if (idx !== -1) handAfterThrow.splice(idx, 1);

          const availableActionCards = handAfterThrow.filter(
            (c) => c !== CARD_WOUND && getActionCardColor(c) !== null
          );

          if (availableActionCards.length < (multiplier ?? 1)) {
            return false;
          }
        }
      }
    }

    return true;
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

  const eligibleCards = getCardsEligibleForMaximalEffect(player.hand, sourceCardId, effect.effectKind, effect.multiplier);

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
