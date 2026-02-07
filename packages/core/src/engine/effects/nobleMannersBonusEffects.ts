/**
 * Noble Manners interaction bonus effect handlers
 *
 * Handles Noble Manners card effects:
 * - EFFECT_APPLY_INTERACTION_BONUS: Grants a turn-scoped modifier that gives
 *   fame and/or reputation on the first interaction this turn (recruit, heal, buy spell).
 *   The modifier is consumed after the first interaction.
 *
 * @module effects/nobleMannersBonusEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { ApplyInteractionBonusEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { InteractionBonusModifier } from "../../types/modifiers.js";
import { registerEffect } from "./effectRegistry.js";
import { addModifier } from "../modifiers/lifecycle.js";
import { EFFECT_APPLY_INTERACTION_BONUS } from "../../types/effectTypes.js";
import {
  EFFECT_INTERACTION_BONUS,
  DURATION_TURN,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";
import { CARD_NOROWAS_NOBLE_MANNERS } from "@mage-knight/shared";

// ============================================================================
// INTERACTION BONUS EFFECT
// ============================================================================

/**
 * Handle EFFECT_APPLY_INTERACTION_BONUS - adds a turn-scoped modifier that grants
 * fame and/or reputation on the first interaction this turn.
 */
function handleApplyInteractionBonus(
  state: GameState,
  playerId: string,
  effect: ApplyInteractionBonusEffect,
): EffectResolutionResult {
  const newState = addModifier(state, {
    source: { type: SOURCE_CARD, cardId: CARD_NOROWAS_NOBLE_MANNERS, playerId },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_INTERACTION_BONUS,
      fame: effect.fame,
      reputation: effect.reputation,
    } satisfies InteractionBonusModifier,
    createdAtRound: state.round,
    createdByPlayerId: playerId,
  });

  const parts: string[] = [];
  if (effect.fame > 0) {
    parts.push(`Fame +${effect.fame}`);
  }
  if (effect.reputation > 0) {
    parts.push(`Reputation +${effect.reputation}`);
  }
  const bonusDesc = parts.join(" and ");

  return {
    state: newState,
    description: `${bonusDesc} on next interaction this turn`,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register all Noble Manners interaction bonus effect handlers with the effect registry.
 */
export function registerNobleMannersBonusEffects(): void {
  registerEffect(EFFECT_APPLY_INTERACTION_BONUS, (state, playerId, effect) => {
    return handleApplyInteractionBonus(state, playerId, effect as ApplyInteractionBonusEffect);
  });
}
