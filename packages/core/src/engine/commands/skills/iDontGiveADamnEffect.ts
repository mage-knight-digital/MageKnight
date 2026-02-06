/**
 * I Don't Give a Damn skill effect handler
 *
 * Tovak's skill: One sideways card gives +2 instead of +1.
 * Advanced Actions, Spells, and Artifacts give +3 instead.
 *
 * Implementation:
 * - Creates one SidewaysValueModifier with value 2 (all non-wounds)
 * - Creates one SidewaysValueModifier with value 3 (AA/Spell/Artifact only)
 * - The modifier system uses Math.max() to pick the best applicable value
 */

import type { GameState } from "../../../state/GameState.js";
import { addModifier } from "../../modifiers/index.js";
import { SKILL_TOVAK_I_DONT_GIVE_A_DAMN } from "../../../data/skills/index.js";
import {
  DURATION_TURN,
  EFFECT_SIDEWAYS_VALUE,
  SCOPE_SELF,
  SOURCE_SKILL,
} from "../../../types/modifierConstants.js";
import {
  DEED_CARD_TYPE_ADVANCED_ACTION,
  DEED_CARD_TYPE_SPELL,
  DEED_CARD_TYPE_ARTIFACT,
} from "../../../types/cards.js";

/**
 * Apply the I Don't Give a Damn skill effect.
 *
 * Creates:
 * 1. A +2 sideways value modifier (all non-wound cards)
 * 2. A +3 sideways value modifier (AA/Spell/Artifact only)
 *
 * The modifier system uses Math.max() to pick the best applicable value,
 * so +3 will apply for AA/Spell/Artifact, otherwise +2 for Basic Actions.
 */
export function applyIDontGiveADamnEffect(
  state: GameState,
  playerId: string
): GameState {
  // Add +2 modifier (baseline for all non-wound cards)
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
      forWounds: false,
    },
    createdAtRound: state.round,
    createdByPlayerId: playerId,
  });

  // Add +3 modifier (Advanced Actions, Spells, Artifacts only)
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
      forWounds: false,
      forCardTypes: [
        DEED_CARD_TYPE_ADVANCED_ACTION,
        DEED_CARD_TYPE_SPELL,
        DEED_CARD_TYPE_ARTIFACT,
      ],
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
