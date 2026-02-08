/**
 * Learning card effect handlers
 *
 * Handles Learning card effects:
 * - EFFECT_APPLY_LEARNING_DISCOUNT: Grants a turn-scoped modifier that enables
 *   a one-time discounted AA purchase from the regular offer.
 *   Basic: pay 6 influence, AA to discard pile.
 *   Powered: pay 9 influence, AA to hand.
 *   The modifier is consumed when the purchase is made.
 *
 * @module effects/learningEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { ApplyLearningDiscountEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { LearningDiscountModifier } from "../../types/modifiers.js";
import { registerEffect } from "./effectRegistry.js";
import { addModifier } from "../modifiers/lifecycle.js";
import { EFFECT_APPLY_LEARNING_DISCOUNT } from "../../types/effectTypes.js";
import {
  EFFECT_LEARNING_DISCOUNT,
  DURATION_TURN,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";
import { CARD_LEARNING } from "@mage-knight/shared";

// ============================================================================
// LEARNING DISCOUNT EFFECT
// ============================================================================

/**
 * Handle EFFECT_APPLY_LEARNING_DISCOUNT - adds a turn-scoped modifier that enables
 * a one-time discounted AA purchase from the regular offer.
 */
function handleApplyLearningDiscount(
  state: GameState,
  playerId: string,
  effect: ApplyLearningDiscountEffect,
): EffectResolutionResult {
  const newState = addModifier(state, {
    source: { type: SOURCE_CARD, cardId: CARD_LEARNING, playerId },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_LEARNING_DISCOUNT,
      cost: effect.cost,
      destination: effect.destination,
    } satisfies LearningDiscountModifier,
    createdAtRound: state.round,
    createdByPlayerId: playerId,
  });

  const destDesc = effect.destination === "hand" ? "hand" : "discard pile";

  return {
    state: newState,
    description: `May pay ${effect.cost} Influence to gain an AA to ${destDesc} this turn`,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register all Learning card effect handlers with the effect registry.
 */
export function registerLearningEffects(): void {
  registerEffect(EFFECT_APPLY_LEARNING_DISCOUNT, (state, playerId, effect) => {
    return handleApplyLearningDiscount(state, playerId, effect as ApplyLearningDiscountEffect);
  });
}
