/**
 * Deadly Aim skill effect handler
 *
 * Wolfhawk's skill: Once per turn, add +1 to a card that provides any type
 * of attack in the Ranged/Siege phase, or +2 in the Attack phase.
 *
 * Implementation:
 * - Creates an AttackBlockCardBonusModifier with phase-aware attack bonus
 * - rangedSiegeAttackBonus: 1 (used in Ranged/Siege phase)
 * - attackBonus: 2 (used in Attack phase)
 * - blockBonus: 0 (Deadly Aim only applies to attack cards)
 * - The modifier is consumed when the first attack card is played
 * - Works on deed cards and sideways attack plays, but NOT on units (FAQ Q1/A1)
 */

import type { GameState } from "../../../state/GameState.js";
import { addModifier } from "../../modifiers/index.js";
import { SKILL_WOLFHAWK_DEADLY_AIM } from "../../../data/skills/index.js";
import {
  DURATION_COMBAT,
  EFFECT_ATTACK_BLOCK_CARD_BONUS,
  SCOPE_SELF,
  SOURCE_SKILL,
} from "../../../types/modifierConstants.js";

/**
 * Apply the Deadly Aim skill effect.
 *
 * Creates a combat-duration modifier that adds a phase-specific bonus
 * to the first attack card played:
 * - +1 in Ranged/Siege phase
 * - +2 in Attack phase
 */
export function applyDeadlyAimEffect(
  state: GameState,
  playerId: string
): GameState {
  return addModifier(state, {
    source: {
      type: SOURCE_SKILL,
      skillId: SKILL_WOLFHAWK_DEADLY_AIM,
      playerId,
    },
    duration: DURATION_COMBAT,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_ATTACK_BLOCK_CARD_BONUS,
      attackBonus: 2,
      blockBonus: 0,
      rangedSiegeAttackBonus: 1,
    },
    createdAtRound: state.round,
    createdByPlayerId: playerId,
  });
}

/**
 * Remove Deadly Aim modifiers for undo.
 */
export function removeDeadlyAimEffect(
  state: GameState,
  playerId: string
): GameState {
  return {
    ...state,
    activeModifiers: state.activeModifiers.filter(
      (m) =>
        !(
          m.source.type === SOURCE_SKILL &&
          m.source.skillId === SKILL_WOLFHAWK_DEADLY_AIM &&
          m.source.playerId === playerId
        )
    ),
  };
}
