/**
 * Heroic Tale effect handlers
 *
 * Handles Heroic Tale card effects:
 * - EFFECT_APPLY_RECRUITMENT_BONUS: Grants a turn-scoped modifier that gives
 *   reputation and/or fame per unit recruited this turn.
 *
 * @module effects/heroicTaleEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { ApplyRecruitmentBonusEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { UnitRecruitmentBonusModifier } from "../../types/modifiers.js";
import { registerEffect } from "./effectRegistry.js";
import { addModifier } from "../modifiers/lifecycle.js";
import { EFFECT_APPLY_RECRUITMENT_BONUS } from "../../types/effectTypes.js";
import {
  EFFECT_RECRUITMENT_BONUS,
  DURATION_TURN,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";
import { CARD_HEROIC_TALE } from "@mage-knight/shared";

// ============================================================================
// RECRUITMENT BONUS EFFECT
// ============================================================================

/**
 * Handle EFFECT_APPLY_RECRUITMENT_BONUS - adds a turn-scoped modifier that grants
 * reputation and/or fame each time a unit is recruited for the rest of the turn.
 */
function handleApplyRecruitmentBonus(
  state: GameState,
  playerId: string,
  effect: ApplyRecruitmentBonusEffect,
): EffectResolutionResult {
  const newState = addModifier(state, {
    source: { type: SOURCE_CARD, cardId: CARD_HEROIC_TALE, playerId },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_RECRUITMENT_BONUS,
      reputationPerRecruit: effect.reputationPerRecruit,
      famePerRecruit: effect.famePerRecruit,
    } satisfies UnitRecruitmentBonusModifier,
    createdAtRound: state.round,
    createdByPlayerId: playerId,
  });

  const parts: string[] = [];
  if (effect.reputationPerRecruit !== 0) {
    parts.push(`Reputation +${effect.reputationPerRecruit}`);
  }
  if (effect.famePerRecruit > 0) {
    parts.push(`Fame +${effect.famePerRecruit}`);
  }
  const bonusDesc = parts.join(" and ");

  return {
    state: newState,
    description: `${bonusDesc} per unit recruited this turn`,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register all Heroic Tale effect handlers with the effect registry.
 */
export function registerHeroicTaleEffects(): void {
  registerEffect(EFFECT_APPLY_RECRUITMENT_BONUS, (state, playerId, effect) => {
    return handleApplyRecruitmentBonus(state, playerId, effect as ApplyRecruitmentBonusEffect);
  });
}
