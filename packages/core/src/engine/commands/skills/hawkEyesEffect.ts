/**
 * Hawk Eyes - Wolfhawk Skill Effect Handler
 *
 * Active: Move 1 (once per turn)
 * Night: exploring costs 1 less Move for the entire turn (S1)
 * Day: reveal garrisons of fortified sites at distance 2 for the entire turn (S1)
 *
 * The passive bonuses are added as turn-duration modifiers when the skill is activated,
 * based on time of day. Per FAQ S1, these last the full turn, not just the activation.
 *
 * @module commands/skills/hawkEyesEffect
 */

import type { GameState } from "../../../state/GameState.js";
import { TIME_OF_DAY_DAY, TIME_OF_DAY_NIGHT } from "@mage-knight/shared";
import { SKILL_WOLFHAWK_HAWK_EYES } from "../../../data/skills/wolfhawk/hawkEyes.js";
import { getPlayerIndexByIdOrThrow } from "../../helpers/playerHelpers.js";
import { addModifier } from "../../modifiers/lifecycle.js";
import {
  DURATION_TURN,
  EFFECT_EXPLORE_COST_REDUCTION,
  EFFECT_RULE_OVERRIDE,
  RULE_GARRISON_REVEAL_DISTANCE_2,
  SCOPE_SELF,
  SOURCE_SKILL,
} from "../../../types/modifierConstants.js";

/**
 * Apply Hawk Eyes effect on activation.
 *
 * 1. Grant Move 1
 * 2. If Night: add explore cost reduction modifier (-1) for the turn
 * 3. If Day: add garrison reveal distance 2 modifier for the turn
 */
export function applyHawkEyesEffect(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];
  if (!player) throw new Error(`Player not found: ${playerId}`);

  // Grant Move 1
  const updatedPlayer = {
    ...player,
    movePoints: player.movePoints + 1,
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;
  let updatedState: GameState = { ...state, players };

  // Add time-of-day conditional modifier
  if (state.timeOfDay === TIME_OF_DAY_NIGHT) {
    // Night: exploring costs 1 less Move for the entire turn
    updatedState = addModifier(updatedState, {
      source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_HAWK_EYES, playerId },
      duration: DURATION_TURN,
      scope: { type: SCOPE_SELF },
      effect: {
        type: EFFECT_EXPLORE_COST_REDUCTION,
        amount: -1,
      },
      createdAtRound: state.round,
      createdByPlayerId: playerId,
    });
  } else if (state.timeOfDay === TIME_OF_DAY_DAY) {
    // Day: reveal garrisons of fortified sites at distance 2
    updatedState = addModifier(updatedState, {
      source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_HAWK_EYES, playerId },
      duration: DURATION_TURN,
      scope: { type: SCOPE_SELF },
      effect: {
        type: EFFECT_RULE_OVERRIDE,
        rule: RULE_GARRISON_REVEAL_DISTANCE_2,
      },
      createdAtRound: state.round,
      createdByPlayerId: playerId,
    });
  }

  return updatedState;
}

/**
 * Remove Hawk Eyes effect on undo.
 *
 * 1. Remove Move 1
 * 2. Remove any added modifiers (turn-duration modifiers from this skill)
 */
export function removeHawkEyesEffect(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];
  if (!player) throw new Error(`Player not found: ${playerId}`);

  // Remove Move 1
  const updatedPlayer = {
    ...player,
    movePoints: player.movePoints - 1,
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  // Remove modifiers added by this skill activation
  const activeModifiers = state.activeModifiers.filter((m) => {
    if (
      m.source.type === SOURCE_SKILL &&
      m.source.skillId === SKILL_WOLFHAWK_HAWK_EYES &&
      m.createdByPlayerId === playerId &&
      m.duration === DURATION_TURN
    ) {
      return false;
    }
    return true;
  });

  return { ...state, players, activeModifiers };
}
