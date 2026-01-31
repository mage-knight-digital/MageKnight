/**
 * Use skill command - handles activating a skill with undo support
 *
 * Skills are activated differently from cards:
 * - No mana required (effects are self-contained)
 * - Cooldown tracking (usedThisRound, usedThisTurn, activeUntilNextTurn)
 * - Some skills can be used on other players' turns (canUseOutOfTurn)
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { SkillCooldowns } from "../../types/player.js";
import type { SkillId, GameEvent } from "@mage-knight/shared";
import { createSkillUsedEvent } from "@mage-knight/shared";
import { resolveEffect } from "../effects/index.js";
import {
  getSkillDefinition,
  SKILL_USAGE_ONCE_PER_ROUND,
} from "../../data/skills/index.js";
import { USE_SKILL_COMMAND } from "./commandTypes.js";

export { USE_SKILL_COMMAND };

export interface UseSkillCommandParams {
  readonly playerId: string;
  readonly skillId: SkillId;
}

/**
 * Create a use skill command.
 *
 * Executes the skill's effect and updates cooldown tracking.
 */
export function createUseSkillCommand(params: UseSkillCommandParams): Command {
  // Store the previous cooldown state for undo
  let previousCooldowns: SkillCooldowns | null = null;

  return {
    type: USE_SKILL_COMMAND,
    playerId: params.playerId,
    isReversible: true, // Can undo skill usage (before irreversible action)

    execute(state: GameState): CommandResult {
      const skill = getSkillDefinition(params.skillId);
      if (!skill) {
        throw new Error(`Skill not found: ${params.skillId}`);
      }

      if (!skill.effect) {
        throw new Error(`Skill has no effect: ${params.skillId}`);
      }

      const playerIndex = state.players.findIndex((p) => p.id === params.playerId);
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found at index: ${playerIndex}`);
      }

      // Store for undo
      previousCooldowns = player.skillCooldowns;

      // Resolve skill effect
      const effectResult = resolveEffect(state, params.playerId, skill.effect, undefined);
      let newState = effectResult.state;

      // Update skill cooldowns based on usage type
      const players = [...newState.players];
      const updatedPlayerState = players[playerIndex];
      if (!updatedPlayerState) {
        throw new Error(`Player not found after effect resolution: ${params.playerId}`);
      }

      // For once-per-round skills like Motivation:
      // - Add to usedThisRound (prevents use for rest of round)
      // - Add to activeUntilNextTurn (provides lockout until next turn ends)
      // - Add to usedThisTurn (tracks that skill was used THIS turn, for lockout expiry logic)
      // For once-per-turn skills:
      // - Add to usedThisTurn only
      const newCooldowns: SkillCooldowns = {
        ...updatedPlayerState.skillCooldowns,
        usedThisRound:
          skill.usageType === SKILL_USAGE_ONCE_PER_ROUND
            ? [...updatedPlayerState.skillCooldowns.usedThisRound, params.skillId]
            : updatedPlayerState.skillCooldowns.usedThisRound,
        // Always add to usedThisTurn for lockout tracking purposes
        usedThisTurn: [...updatedPlayerState.skillCooldowns.usedThisTurn, params.skillId],
        // For once-per-round skills, also add to activeUntilNextTurn for the lockout
        activeUntilNextTurn:
          skill.usageType === SKILL_USAGE_ONCE_PER_ROUND
            ? [...updatedPlayerState.skillCooldowns.activeUntilNextTurn, params.skillId]
            : updatedPlayerState.skillCooldowns.activeUntilNextTurn,
        usedThisCombat: updatedPlayerState.skillCooldowns.usedThisCombat,
      };

      players[playerIndex] = {
        ...updatedPlayerState,
        skillCooldowns: newCooldowns,
      };

      newState = { ...newState, players };

      // Build events
      const events: GameEvent[] = [
        createSkillUsedEvent(params.playerId, params.skillId),
        // Include any events from the effect resolution
        // Note: effectResult doesn't return events, effects emit via state changes
        // The effect description is available in effectResult.description
      ];

      return {
        state: newState,
        events,
      };
    },

    undo(state: GameState): CommandResult {
      // Restore previous cooldown state
      if (!previousCooldowns) {
        return { state, events: [] };
      }

      const playerIndex = state.players.findIndex((p) => p.id === params.playerId);
      if (playerIndex === -1) {
        return { state, events: [] };
      }

      const players = [...state.players];
      const player = players[playerIndex];
      if (!player) {
        return { state, events: [] };
      }

      players[playerIndex] = {
        ...player,
        skillCooldowns: previousCooldowns,
      };

      return { state: { ...state, players }, events: [] };
    },
  };
}
