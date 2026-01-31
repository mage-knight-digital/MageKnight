/**
 * Who Needs Magic? skill effect handler
 *
 * Tovak's skill: One sideways card gives +2 instead of +1.
 * If no Source die has been used this turn, it gives +3 instead
 * (but locks out Source dice for the rest of the turn).
 *
 * Implementation:
 * - Creates two SidewaysValueModifiers (value 2 and value 3 with condition)
 * - If player hasn't used Source die yet, adds RULE_SOURCE_BLOCKED modifier
 */

import type { GameState } from "../../../state/GameState.js";
import { addModifier } from "../../modifiers.js";
import { SKILL_TOVAK_WHO_NEEDS_MAGIC } from "../../../data/skills/index.js";
import {
  DURATION_TURN,
  EFFECT_RULE_OVERRIDE,
  EFFECT_SIDEWAYS_VALUE,
  RULE_SOURCE_BLOCKED,
  SCOPE_SELF,
  SIDEWAYS_CONDITION_NO_MANA_USED,
  SOURCE_SKILL,
} from "../../modifierConstants.js";

/**
 * Apply the Who Needs Magic? skill effect.
 *
 * Creates:
 * 1. A +2 sideways value modifier (unconditional)
 * 2. A +3 sideways value modifier (conditional on no mana die used)
 * 3. If player hasn't used Source die: RULE_SOURCE_BLOCKED modifier
 *
 * The modifier system uses Math.max() to pick the best applicable value,
 * so +3 will apply if the condition is met, otherwise +2.
 */
export function applyWhoNeedsMagicEffect(
  state: GameState,
  playerId: string
): GameState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    throw new Error(`Player not found: ${playerId}`);
  }

  // Add +2 modifier (unconditional - always applies as baseline)
  state = addModifier(state, {
    source: {
      type: SOURCE_SKILL,
      skillId: SKILL_TOVAK_WHO_NEEDS_MAGIC,
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

  // Add +3 modifier (conditional on no mana die used from Source)
  state = addModifier(state, {
    source: {
      type: SOURCE_SKILL,
      skillId: SKILL_TOVAK_WHO_NEEDS_MAGIC,
      playerId,
    },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_SIDEWAYS_VALUE,
      newValue: 3,
      forWounds: false,
      condition: SIDEWAYS_CONDITION_NO_MANA_USED,
    },
    createdAtRound: state.round,
    createdByPlayerId: playerId,
  });

  // If player hasn't used Source die yet, lock them out for the rest of the turn
  // This is the "commitment" for choosing the +3 path
  if (!player.usedManaFromSource) {
    state = addModifier(state, {
      source: {
        type: SOURCE_SKILL,
        skillId: SKILL_TOVAK_WHO_NEEDS_MAGIC,
        playerId,
      },
      duration: DURATION_TURN,
      scope: { type: SCOPE_SELF },
      effect: {
        type: EFFECT_RULE_OVERRIDE,
        rule: RULE_SOURCE_BLOCKED,
      },
      createdAtRound: state.round,
      createdByPlayerId: playerId,
    });
  }

  return state;
}

/**
 * Remove all modifiers created by Who Needs Magic? skill for a player.
 * Used for undo functionality.
 */
export function removeWhoNeedsMagicEffect(
  state: GameState,
  playerId: string
): GameState {
  return {
    ...state,
    activeModifiers: state.activeModifiers.filter(
      (m) =>
        !(
          m.source.type === SOURCE_SKILL &&
          m.source.skillId === SKILL_TOVAK_WHO_NEEDS_MAGIC &&
          m.source.playerId === playerId
        )
    ),
  };
}
