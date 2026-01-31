/**
 * Use Skill Command
 *
 * Handles activating skills. Each skill has its own handler that applies
 * the appropriate modifiers or effects.
 *
 * @module commands/skills/useSkillCommand
 */

import type { Command, CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";
import type { Player, SkillCooldowns } from "../../../types/player.js";
import type { SkillId } from "@mage-knight/shared";
import { createSkillUsedEvent } from "@mage-knight/shared";
import {
  getSkillDefinition,
  SKILL_USAGE_ONCE_PER_TURN,
  SKILL_USAGE_ONCE_PER_ROUND,
} from "../../../data/skills/index.js";
import { applyPowerOfPain, isPowerOfPainSkill } from "./powerOfPain.js";
import { SOURCE_SKILL } from "../../modifierConstants.js";

export const USE_SKILL_COMMAND = "USE_SKILL" as const;

export interface UseSkillCommandParams {
  readonly playerId: string;
  readonly skillId: SkillId;
}

/**
 * Create a use skill command.
 */
export function createUseSkillCommand(params: UseSkillCommandParams): Command {
  // Store the modifier IDs added during execute for undo
  let addedModifierIds: string[] = [];
  let previousCooldowns: SkillCooldowns | null = null;

  return {
    type: USE_SKILL_COMMAND,
    playerId: params.playerId,
    isReversible: true,

    execute(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found at index: ${playerIndex}`);
      }

      // Store previous cooldowns for undo
      previousCooldowns = player.skillCooldowns;

      // Dispatch to skill-specific handler
      let newState = state;
      if (isPowerOfPainSkill(params.skillId)) {
        newState = applyPowerOfPain(state, params.playerId, params.skillId);
      }
      // Future: add more skill handlers here

      // Track which modifiers were added
      addedModifierIds = newState.activeModifiers
        .filter(
          (m) =>
            m.source.type === SOURCE_SKILL &&
            m.source.skillId === params.skillId &&
            m.createdByPlayerId === params.playerId &&
            !state.activeModifiers.some((existing) => existing.id === m.id)
        )
        .map((m) => m.id);

      // Update skill cooldowns
      const skillDef = getSkillDefinition(params.skillId);
      const updatedPlayer = updateSkillCooldowns(player, params.skillId, skillDef?.usageType);

      const players = [...newState.players];
      players[playerIndex] = updatedPlayer;

      return {
        state: { ...newState, players },
        events: [createSkillUsedEvent(params.playerId, params.skillId)],
      };
    },

    undo(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found at index: ${playerIndex}`);
      }

      // Remove added modifiers
      const remainingModifiers = state.activeModifiers.filter(
        (m) => !addedModifierIds.includes(m.id)
      );

      // Restore previous cooldowns
      const updatedPlayer: Player = {
        ...player,
        skillCooldowns: previousCooldowns ?? player.skillCooldowns,
      };

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      return {
        state: {
          ...state,
          players,
          activeModifiers: remainingModifiers,
        },
        events: [], // No specific undo event needed
      };
    },
  };
}

/**
 * Update player's skill cooldowns based on skill usage type.
 */
function updateSkillCooldowns(
  player: Player,
  skillId: SkillId,
  usageType: string | undefined
): Player {
  const cooldowns = player.skillCooldowns;

  switch (usageType) {
    case SKILL_USAGE_ONCE_PER_TURN:
      return {
        ...player,
        skillCooldowns: {
          ...cooldowns,
          usedThisTurn: [...cooldowns.usedThisTurn, skillId],
        },
      };

    case SKILL_USAGE_ONCE_PER_ROUND:
      return {
        ...player,
        skillCooldowns: {
          ...cooldowns,
          usedThisRound: [...cooldowns.usedThisRound, skillId],
        },
      };

    default:
      // Passive or interactive skills don't track cooldowns here
      return player;
  }
}
