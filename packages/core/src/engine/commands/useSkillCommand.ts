/**
 * Use Skill command - handles activating a player skill
 *
 * Skills are permanent abilities gained at level up. This command handles
 * "once per turn" and "once per round" skills that require explicit activation.
 *
 * Passive skills don't require this command - they are always active.
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { Player, SkillCooldowns } from "../../types/player.js";
import type { SkillId } from "@mage-knight/shared";
import { createSkillUsedEvent } from "@mage-knight/shared";
import { USE_SKILL_COMMAND } from "./commandTypes.js";
import {
  SKILLS,
  SKILL_USAGE_ONCE_PER_TURN,
  SKILL_USAGE_ONCE_PER_ROUND,
  SKILL_TOVAK_WHO_NEEDS_MAGIC,
  SKILL_TOVAK_SHIELD_MASTERY,
  SKILL_TOVAK_I_FEEL_NO_PAIN,
} from "../../data/skills/index.js";
import {
  applyWhoNeedsMagicEffect,
  removeWhoNeedsMagicEffect,
  applyShieldMasteryEffect,
  removeShieldMasteryEffect,
  applyIFeelNoPainEffect,
  removeIFeelNoPainEffect,
} from "./skills/index.js";

export { USE_SKILL_COMMAND };

export interface UseSkillCommandParams {
  readonly playerId: string;
  readonly skillId: SkillId;
}

/**
 * Apply the skill effect based on skill ID.
 * Returns updated state with skill effects applied.
 */
function applySkillEffect(
  state: GameState,
  playerId: string,
  skillId: SkillId
): GameState {
  switch (skillId) {
    case SKILL_TOVAK_WHO_NEEDS_MAGIC:
      return applyWhoNeedsMagicEffect(state, playerId);

    case SKILL_TOVAK_SHIELD_MASTERY:
      return applyShieldMasteryEffect(state, playerId);

    case SKILL_TOVAK_I_FEEL_NO_PAIN:
      return applyIFeelNoPainEffect(state, playerId);

    default:
      // Skill has no implemented effect yet
      return state;
  }
}

/**
 * Remove the skill effect for undo.
 * Returns updated state with skill effects removed.
 */
function removeSkillEffect(
  state: GameState,
  playerId: string,
  skillId: SkillId
): GameState {
  switch (skillId) {
    case SKILL_TOVAK_WHO_NEEDS_MAGIC:
      return removeWhoNeedsMagicEffect(state, playerId);

    case SKILL_TOVAK_SHIELD_MASTERY:
      return removeShieldMasteryEffect(state, playerId);

    case SKILL_TOVAK_I_FEEL_NO_PAIN:
      return removeIFeelNoPainEffect(state, playerId);

    default:
      return state;
  }
}

/**
 * Add a skill to the appropriate cooldown tracker based on usage type.
 */
function addToCooldowns(
  cooldowns: SkillCooldowns,
  skillId: SkillId,
  usageType: string
): SkillCooldowns {
  if (usageType === SKILL_USAGE_ONCE_PER_TURN) {
    return {
      ...cooldowns,
      usedThisTurn: [...cooldowns.usedThisTurn, skillId],
    };
  }
  if (usageType === SKILL_USAGE_ONCE_PER_ROUND) {
    return {
      ...cooldowns,
      usedThisRound: [...cooldowns.usedThisRound, skillId],
    };
  }
  return cooldowns;
}

/**
 * Remove a skill from the appropriate cooldown tracker for undo.
 */
function removeFromCooldowns(
  cooldowns: SkillCooldowns,
  skillId: SkillId,
  usageType: string
): SkillCooldowns {
  if (usageType === SKILL_USAGE_ONCE_PER_TURN) {
    return {
      ...cooldowns,
      usedThisTurn: cooldowns.usedThisTurn.filter((id) => id !== skillId),
    };
  }
  if (usageType === SKILL_USAGE_ONCE_PER_ROUND) {
    return {
      ...cooldowns,
      usedThisRound: cooldowns.usedThisRound.filter((id) => id !== skillId),
    };
  }
  return cooldowns;
}

/**
 * Create a use skill command.
 */
export function createUseSkillCommand(params: UseSkillCommandParams): Command {
  const { playerId, skillId } = params;

  return {
    type: USE_SKILL_COMMAND,
    playerId,
    isReversible: true, // Skills can be undone within the same turn

    execute(state: GameState): CommandResult {
      const skill = SKILLS[skillId];
      if (!skill) {
        throw new Error(`Skill not found: ${skillId}`);
      }

      const playerIndex = state.players.findIndex((p) => p.id === playerId);
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${playerId}`);
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found at index: ${playerIndex}`);
      }

      // Add skill to cooldowns
      const updatedCooldowns = addToCooldowns(
        player.skillCooldowns,
        skillId,
        skill.usageType
      );

      // Update player with new cooldowns
      const updatedPlayer: Player = {
        ...player,
        skillCooldowns: updatedCooldowns,
      };

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      let updatedState: GameState = { ...state, players };

      // Apply skill effect
      updatedState = applySkillEffect(updatedState, playerId, skillId);

      return {
        state: updatedState,
        events: [createSkillUsedEvent(playerId, skillId)],
      };
    },

    undo(state: GameState): CommandResult {
      const skill = SKILLS[skillId];
      if (!skill) {
        throw new Error(`Skill not found: ${skillId}`);
      }

      const playerIndex = state.players.findIndex((p) => p.id === playerId);
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${playerId}`);
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found at index: ${playerIndex}`);
      }

      // Remove skill from cooldowns
      const updatedCooldowns = removeFromCooldowns(
        player.skillCooldowns,
        skillId,
        skill.usageType
      );

      // Update player with restored cooldowns
      const updatedPlayer: Player = {
        ...player,
        skillCooldowns: updatedCooldowns,
      };

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      let updatedState: GameState = { ...state, players };

      // Remove skill effect
      updatedState = removeSkillEffect(updatedState, playerId, skillId);

      return {
        state: updatedState,
        events: [], // No event for undo
      };
    },
  };
}
