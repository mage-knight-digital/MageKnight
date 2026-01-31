/**
 * Use Skill Command - handles activating a player's skill
 *
 * This command handles skill activation for "flip-to-use" skills:
 * - Dark Fire Magic (Arythea): Gain 1 red crystal and 1 red or black mana token
 * - And other once-per-round skills
 *
 * Skills use the same effect system as cards, but are triggered via USE_SKILL_ACTION.
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { GameEvent, SkillId } from "@mage-knight/shared";
import { INVALID_ACTION, SKILL_USED } from "@mage-knight/shared";
import { createChoiceRequiredEvent } from "@mage-knight/shared";
import { describeEffect } from "../effects/index.js";
import { USE_SKILL_COMMAND } from "./commandTypes.js";
import {
  SKILL_USAGE_ONCE_PER_ROUND,
  SKILL_USAGE_ONCE_PER_TURN,
  SKILL_USAGE_PASSIVE,
  getSkillDefinition,
} from "../../data/skills/index.js";
import { resolveEffect } from "../effects/index.js";
import type { CardEffect } from "../../types/cards.js";

export { USE_SKILL_COMMAND };

export interface UseSkillCommandArgs {
  readonly playerId: string;
  readonly skillId: SkillId;
}

/**
 * Validate skill activation
 */
function validateSkillActivation(
  state: GameState,
  playerId: string,
  skillId: SkillId
): string | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return "Player not found";
  }

  // Must own the skill
  if (!player.skills.includes(skillId)) {
    return `You do not own the skill ${skillId}`;
  }

  // Get skill definition
  const skillDef = getSkillDefinition(skillId);
  if (!skillDef) {
    return `Unknown skill: ${skillId}`;
  }

  // Passive skills cannot be activated
  if (skillDef.usageType === SKILL_USAGE_PASSIVE) {
    return "Passive skills cannot be activated";
  }

  // Must have an effect defined
  if (!skillDef.effect) {
    return `Skill ${skillId} has no effect implemented`;
  }

  // Check cooldowns based on usage type
  if (skillDef.usageType === SKILL_USAGE_ONCE_PER_ROUND) {
    if (player.skillCooldowns.usedThisRound.includes(skillId)) {
      return "Skill has already been used this round";
    }
  } else if (skillDef.usageType === SKILL_USAGE_ONCE_PER_TURN) {
    if (player.skillCooldowns.usedThisTurn.includes(skillId)) {
      return "Skill has already been used this turn";
    }
  }

  return null;
}

/**
 * Create a use skill command.
 */
export function createUseSkillCommand(args: UseSkillCommandArgs): Command {
  const { playerId, skillId } = args;

  return {
    type: USE_SKILL_COMMAND,
    playerId,
    isReversible: false, // Skill activation is not reversible (it's like flipping a tactic)

    execute(state: GameState): CommandResult {
      const events: GameEvent[] = [];

      // Validate
      const error = validateSkillActivation(state, playerId, skillId);
      if (error) {
        events.push({
          type: INVALID_ACTION,
          playerId,
          actionType: USE_SKILL_COMMAND,
          reason: error,
        });
        return { state, events };
      }

      // Find the player
      const player = state.players.find((p) => p.id === playerId);
      if (!player) {
        return { state, events };
      }

      // Get skill definition
      const skillDef = getSkillDefinition(skillId);
      if (!skillDef || !skillDef.effect) {
        return { state, events };
      }

      // Update cooldowns based on usage type
      let updatedCooldowns = player.skillCooldowns;
      if (skillDef.usageType === SKILL_USAGE_ONCE_PER_ROUND) {
        updatedCooldowns = {
          ...updatedCooldowns,
          usedThisRound: [...updatedCooldowns.usedThisRound, skillId],
        };
      } else if (skillDef.usageType === SKILL_USAGE_ONCE_PER_TURN) {
        updatedCooldowns = {
          ...updatedCooldowns,
          usedThisTurn: [...updatedCooldowns.usedThisTurn, skillId],
        };
      }

      // Update player with cooldowns first
      const playerWithCooldowns: Player = {
        ...player,
        skillCooldowns: updatedCooldowns,
      };

      // Update state with cooldowns
      let updatedState: GameState = {
        ...state,
        players: state.players.map((p) =>
          p.id === playerId ? playerWithCooldowns : p
        ),
      };

      // Emit skill used event
      events.push({
        type: SKILL_USED,
        playerId,
        skillId,
      });

      // Resolve the skill's effect
      const effectResult = resolveEffect(
        updatedState,
        playerId,
        skillDef.effect,
        undefined // No source card for skills
      );

      updatedState = effectResult.state;

      // If the effect requires a choice, set up pending choice on the player
      if (effectResult.requiresChoice) {
        const currentPlayer = updatedState.players.find(
          (p) => p.id === playerId
        );
        if (currentPlayer) {
          // Use dynamic options if available, otherwise use the effect's options
          const choiceOptions =
            effectResult.dynamicChoiceOptions ??
            (skillDef.effect.type === "choice"
              ? (skillDef.effect as { options: readonly CardEffect[] }).options
              : []);

          const updatedPlayer: Player = {
            ...currentPlayer,
            pendingChoice: {
              description: effectResult.description,
              options: choiceOptions,
              sourceSkillId: skillId,
            },
          };

          updatedState = {
            ...updatedState,
            players: updatedState.players.map((p) =>
              p.id === playerId ? updatedPlayer : p
            ),
          };

          // Emit choice required event
          events.push(
            createChoiceRequiredEvent(
              playerId,
              choiceOptions.map((opt) => describeEffect(opt)),
              { skillId }
            )
          );
        }
      }

      return { state: updatedState, events };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo USE_SKILL");
    },
  };
}
