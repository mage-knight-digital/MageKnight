/**
 * Power of Pain Skill Handler
 *
 * Arythea's skill: Once per turn, play one Wound sideways for +2 instead of +1.
 * The Wound goes to discard pile at end of turn (already default behavior).
 *
 * @module commands/skills/powerOfPain
 */

import type { GameState } from "../../../state/GameState.js";
import type { SkillId } from "@mage-knight/shared";
import type { ActiveModifier, SidewaysValueModifier, RuleOverrideModifier } from "../../../types/modifiers.js";
import { addModifier } from "../../modifiers.js";
import {
  DURATION_TURN,
  EFFECT_RULE_OVERRIDE,
  EFFECT_SIDEWAYS_VALUE,
  RULE_WOUNDS_PLAYABLE_SIDEWAYS,
  SCOPE_SELF,
  SOURCE_SKILL,
} from "../../modifierConstants.js";
import { SKILL_ARYTHEA_POWER_OF_PAIN } from "../../../data/skills/index.js";
import { CARD_WOUND } from "@mage-knight/shared";

/**
 * Check if Power of Pain can be activated.
 *
 * Preconditions:
 * - Player has at least one Wound in hand
 *
 * @param state - Current game state
 * @param playerId - Player attempting to use the skill
 * @returns true if skill can be activated
 */
export function canActivatePowerOfPain(
  state: GameState,
  playerId: string
): boolean {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;

  // Check if player has a wound in hand
  return player.hand.some((cardId) => cardId === CARD_WOUND);
}

/**
 * Apply Power of Pain modifiers to game state.
 *
 * Creates two modifiers:
 * 1. RuleOverrideModifier: RULE_WOUNDS_PLAYABLE_SIDEWAYS - allows wounds to be played sideways
 * 2. SidewaysValueModifier: forWounds=true, newValue=2 - gives +2 value for wounds
 *
 * @param state - Current game state
 * @param playerId - Player using the skill
 * @param skillId - The skill being used (for tracking)
 * @returns New state with modifiers applied
 */
export function applyPowerOfPain(
  state: GameState,
  playerId: string,
  skillId: SkillId
): GameState {
  const currentRound = state.round;

  // Modifier 1: Allow wounds to be played sideways
  const ruleModifier: Omit<ActiveModifier, "id"> = {
    source: { type: SOURCE_SKILL, skillId, playerId },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_RULE_OVERRIDE,
      rule: RULE_WOUNDS_PLAYABLE_SIDEWAYS,
    } as RuleOverrideModifier,
    createdAtRound: currentRound,
    createdByPlayerId: playerId,
  };

  let newState = addModifier(state, ruleModifier);

  // Modifier 2: Set sideways value to 2 for wounds
  const valueModifier: Omit<ActiveModifier, "id"> = {
    source: { type: SOURCE_SKILL, skillId, playerId },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_SIDEWAYS_VALUE,
      newValue: 2,
      forWounds: true,
    } as SidewaysValueModifier,
    createdAtRound: currentRound,
    createdByPlayerId: playerId,
  };

  newState = addModifier(newState, valueModifier);

  return newState;
}

/**
 * Check if a skill is Power of Pain.
 */
export function isPowerOfPainSkill(skillId: SkillId): boolean {
  return skillId === SKILL_ARYTHEA_POWER_OF_PAIN;
}
