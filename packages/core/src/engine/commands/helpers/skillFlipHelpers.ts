/**
 * Skill Flip State Helpers
 *
 * Shared helpers for flipping skills face-down and face-up.
 * Used by resolveChoiceCommand (Battle Frenzy flip), completeRestCommand
 * (rest flip-back), and endRound (round-start flip-back).
 *
 * @module commands/helpers/skillFlipHelpers
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { SkillId } from "@mage-knight/shared";

/**
 * Flip a skill face-down on the specified player.
 * If already face-down, this is a no-op.
 */
export function flipSkillFaceDown(
  state: GameState,
  playerId: string,
  skillId: SkillId
): GameState {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return state;

  const player = state.players[playerIndex]!;
  if (player.skillFlipState.flippedSkills.includes(skillId)) {
    return state;
  }

  const updatedPlayer: Player = {
    ...player,
    skillFlipState: {
      ...player.skillFlipState,
      flippedSkills: [...player.skillFlipState.flippedSkills, skillId],
    },
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return { ...state, players };
}

/**
 * Flip a skill back face-up (unflip) on the specified player.
 * If already face-up, this is a no-op.
 */
export function unflipSkill(
  state: GameState,
  playerId: string,
  skillId: SkillId
): GameState {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return state;

  const player = state.players[playerIndex]!;
  if (!player.skillFlipState.flippedSkills.includes(skillId)) {
    return state;
  }

  const updatedPlayer: Player = {
    ...player,
    skillFlipState: {
      ...player.skillFlipState,
      flippedSkills: player.skillFlipState.flippedSkills.filter(
        (s) => s !== skillId
      ),
    },
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return { ...state, players };
}
