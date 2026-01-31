/**
 * I Don't Give a Damn skill effect handler
 *
 * Tovak's skill: One sideways card gives +2 instead of +1.
 * If it's an Advanced Action, Spell, or Artifact, it gives +3 instead.
 *
 * FAQ Rulings:
 * - S1: Cannot stack with Who Needs Magic, Universal Power, or Wolf's Howl
 * - S2: Hero-specific cards (Cold Toughness, etc.) are Basic Actions (+2, not +3)
 * - S3: Cannot be used with Wound cards
 *
 * Implementation:
 * - Creates two SidewaysValueModifiers:
 *   1. +2 unconditional (for Basic Actions)
 *   2. +3 conditional on SIDEWAYS_CONDITION_ADVANCED_CARD_TYPE (for AA/Spell/Artifact)
 * - The modifier system uses Math.max() to pick the best applicable value
 */

import type { GameState } from "../../../state/GameState.js";
import { addModifier } from "../../modifiers.js";
import { SKILL_TOVAK_I_DONT_GIVE_A_DAMN } from "../../../data/skills/index.js";
import {
  DURATION_TURN,
  EFFECT_SIDEWAYS_VALUE,
  SCOPE_SELF,
  SIDEWAYS_CONDITION_ADVANCED_CARD_TYPE,
  SOURCE_SKILL,
} from "../../modifierConstants.js";

/**
 * Apply the I Don't Give a Damn skill effect.
 *
 * Creates:
 * 1. A +2 sideways value modifier (unconditional - applies to Basic Actions)
 * 2. A +3 sideways value modifier (conditional on Advanced Action/Spell/Artifact)
 *
 * The modifier system uses Math.max() to pick the best applicable value,
 * so +3 will apply for AA/Spell/Artifact, otherwise +2.
 */
export function applyIDontGiveADamnEffect(
  state: GameState,
  playerId: string
): GameState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    throw new Error(`Player not found: ${playerId}`);
  }

  // Add +2 modifier (unconditional - applies to all non-wound cards including Basic Actions)
  state = addModifier(state, {
    source: {
      type: SOURCE_SKILL,
      skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      playerId,
    },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_SIDEWAYS_VALUE,
      newValue: 2,
      forWounds: false, // Cannot be used with Wound cards (FAQ S3)
    },
    createdAtRound: state.round,
    createdByPlayerId: playerId,
  });

  // Add +3 modifier (conditional on Advanced Action/Spell/Artifact)
  state = addModifier(state, {
    source: {
      type: SOURCE_SKILL,
      skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      playerId,
    },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_SIDEWAYS_VALUE,
      newValue: 3,
      forWounds: false, // Cannot be used with Wound cards (FAQ S3)
      condition: SIDEWAYS_CONDITION_ADVANCED_CARD_TYPE,
    },
    createdAtRound: state.round,
    createdByPlayerId: playerId,
  });

  return state;
}

/**
 * Remove all modifiers created by I Don't Give a Damn skill for a player.
 * Used for undo functionality.
 */
export function removeIDontGiveADamnEffect(
  state: GameState,
  playerId: string
): GameState {
  return {
    ...state,
    activeModifiers: state.activeModifiers.filter(
      (m) =>
        !(
          m.source.type === SOURCE_SKILL &&
          m.source.skillId === SKILL_TOVAK_I_DONT_GIVE_A_DAMN &&
          m.source.playerId === playerId
        )
    ),
  };
}
