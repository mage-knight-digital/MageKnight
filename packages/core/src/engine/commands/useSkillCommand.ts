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
import type { GameEvent } from "@mage-knight/shared";
import {
  CHOICE_REQUIRED,
  createSkillUsedEvent,
} from "@mage-knight/shared";
import { USE_SKILL_COMMAND } from "./commandTypes.js";
import {
  SKILLS,
  SKILL_USAGE_ONCE_PER_TURN,
  SKILL_USAGE_ONCE_PER_ROUND,
  SKILL_TOVAK_WHO_NEEDS_MAGIC,
} from "../../data/skills/index.js";
import {
  applyWhoNeedsMagicEffect,
  removeWhoNeedsMagicEffect,
} from "./skills/index.js";
import { resolveEffect, describeEffect, isEffectResolvable } from "../effects/index.js";
import { SOURCE_SKILL } from "../modifierConstants.js";

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

    default: {
      // For skills with effects, remove any modifiers created by this skill
      const skill = SKILLS[skillId];
      if (skill?.effect) {
        return {
          ...state,
          activeModifiers: state.activeModifiers.filter(
            (m) =>
              !(
                m.source.type === SOURCE_SKILL &&
                m.source.skillId === skillId &&
                m.source.playerId === playerId
              )
          ),
        };
      }
      return state;
    }
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

      // If skill has an effect definition, resolve it through the effect system
      if (skill.effect) {
        const effectResult = resolveEffect(updatedState, playerId, skill.effect);

        // Handle effects that require player choice
        if (effectResult.requiresChoice && effectResult.dynamicChoiceOptions) {
          const choiceOptions = effectResult.dynamicChoiceOptions;

          // Filter to resolvable options
          const resolvableOptions = choiceOptions.filter((opt) =>
            isEffectResolvable(effectResult.state, playerId, opt)
          );

          // If no options resolvable, skill has no valid targets
          if (resolvableOptions.length === 0) {
            return {
              state: effectResult.state,
              events: [createSkillUsedEvent(playerId, skillId)],
            };
          }

          // If only one option, auto-resolve it
          if (resolvableOptions.length === 1) {
            const singleOption = resolvableOptions[0];
            if (!singleOption) {
              throw new Error("Expected single resolvable option");
            }
            const autoResolveResult = resolveEffect(
              effectResult.state,
              playerId,
              singleOption
            );
            return {
              state: autoResolveResult.state,
              events: [createSkillUsedEvent(playerId, skillId)],
            };
          }

          // Multiple options - set up pending choice
          // PendingChoice.cardId accepts CardId | SkillId
          const playerWithChoice: Player = {
            ...updatedPlayer,
            skillCooldowns: updatedCooldowns,
            pendingChoice: {
              cardId: skillId,
              options: resolvableOptions,
            },
          };

          const playersWithChoice = [...effectResult.state.players];
          playersWithChoice[playerIndex] = playerWithChoice;

          const events: GameEvent[] = [
            createSkillUsedEvent(playerId, skillId),
            {
              type: CHOICE_REQUIRED,
              playerId,
              cardId: skillId,
              options: resolvableOptions.map((opt) => describeEffect(opt)),
            },
          ];

          return {
            state: { ...effectResult.state, players: playersWithChoice },
            events,
          };
        }

        return {
          state: effectResult.state,
          events: [createSkillUsedEvent(playerId, skillId)],
        };
      }

      // Apply skill effect via custom handlers (for skills without effect field)
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

      // Update player with restored cooldowns and clear pending choice if it was from this skill
      const updatedPlayer: Player = {
        ...player,
        skillCooldowns: updatedCooldowns,
        // Clear pending choice if it originated from this skill
        pendingChoice:
          player.pendingChoice?.cardId === skillId ? null : player.pendingChoice,
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
