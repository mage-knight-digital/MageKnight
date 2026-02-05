/**
 * Power of Pain skill effect handler
 *
 * Arythea's skill: Once per turn, play one Wound sideways as non-Wound card.
 * It gives +2 instead of +1. At end of turn, put that Wound in discard pile.
 *
 * Implementation:
 * - Creates RULE_WOUNDS_PLAYABLE_SIDEWAYS modifier (allows wounds to be played sideways)
 * - Creates SidewaysValueModifier with newValue 2, forWounds true
 * - Both modifiers have DURATION_TURN and SCOPE_SELF
 * - When wound is played sideways, modifiers are consumed (one wound per activation)
 */

import type { GameState } from "../../../state/GameState.js";
import { addModifier } from "../../modifiers/index.js";
import { SKILL_ARYTHEA_POWER_OF_PAIN } from "../../../data/skills/index.js";
import {
  DURATION_TURN,
  EFFECT_RULE_OVERRIDE,
  EFFECT_SIDEWAYS_VALUE,
  RULE_WOUNDS_PLAYABLE_SIDEWAYS,
  SCOPE_SELF,
  SOURCE_SKILL,
} from "../../../types/modifierConstants.js";

/**
 * Apply the Power of Pain skill effect.
 *
 * Creates:
 * 1. A RULE_WOUNDS_PLAYABLE_SIDEWAYS modifier (enables wound sideways play)
 * 2. A +2 sideways value modifier for wounds
 *
 * Both are scoped to self and last for the turn.
 * When a wound is played sideways, the playCardSidewaysCommand
 * removes these modifiers (one wound per activation).
 */
export function applyPowerOfPainEffect(
  state: GameState,
  playerId: string
): GameState {
  // Add rule override: allows wounds to be played sideways
  state = addModifier(state, {
    source: {
      type: SOURCE_SKILL,
      skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      playerId,
    },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_RULE_OVERRIDE,
      rule: RULE_WOUNDS_PLAYABLE_SIDEWAYS,
    },
    createdAtRound: state.round,
    createdByPlayerId: playerId,
  });

  // Add +2 sideways value modifier for wounds
  state = addModifier(state, {
    source: {
      type: SOURCE_SKILL,
      skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      playerId,
    },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_SIDEWAYS_VALUE,
      newValue: 2,
      forWounds: true,
    },
    createdAtRound: state.round,
    createdByPlayerId: playerId,
  });

  return state;
}

/**
 * Remove all modifiers created by Power of Pain skill for a player.
 * Used for undo functionality.
 */
export function removePowerOfPainEffect(
  state: GameState,
  playerId: string
): GameState {
  return {
    ...state,
    activeModifiers: state.activeModifiers.filter(
      (m) =>
        !(
          m.source.type === SOURCE_SKILL &&
          m.source.skillId === SKILL_ARYTHEA_POWER_OF_PAIN &&
          m.source.playerId === playerId
        )
    ),
  };
}
