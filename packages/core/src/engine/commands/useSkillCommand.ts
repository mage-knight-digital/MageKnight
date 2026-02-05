/**
 * Use Skill command - handles activating a player skill
 *
 * Skills are permanent abilities gained at level up. This command handles
 * "once per turn" and "once per round" skills that require explicit activation.
 *
 * Passive skills don't require this command - they are always active.
 *
 * Skills can have effects defined via the `effect` property, which are resolved
 * using the standard effect resolution system. This supports compound effects,
 * choice effects, and other effect types.
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { Player, SkillCooldowns } from "../../types/player.js";
import type { SkillId } from "@mage-knight/shared";
import {
  createSkillUsedEvent,
} from "@mage-knight/shared";
import { USE_SKILL_COMMAND } from "./commandTypes.js";
import {
  SKILLS,
  SKILL_USAGE_ONCE_PER_TURN,
  SKILL_USAGE_ONCE_PER_ROUND,
  SKILL_USAGE_INTERACTIVE,
  SKILL_TOVAK_WHO_NEEDS_MAGIC,
  SKILL_TOVAK_SHIELD_MASTERY,
  SKILL_TOVAK_I_FEEL_NO_PAIN,
  SKILL_ARYTHEA_POLARIZATION,
  SKILL_ARYTHEA_RITUAL_OF_PAIN,
} from "../../data/skills/index.js";
import {
  applyWhoNeedsMagicEffect,
  removeWhoNeedsMagicEffect,
  applyShieldMasteryEffect,
  removeShieldMasteryEffect,
  applyIFeelNoPainEffect,
  removeIFeelNoPainEffect,
  applyPolarizationEffect,
  removePolarizationEffect,
} from "./skills/index.js";
import { getPlayerIndexByIdOrThrow } from "../helpers/playerHelpers.js";
import {
  resolveEffect,
  reverseEffect,
} from "../effects/index.js";
import type { CardEffect } from "../../types/cards.js";
import { EFFECT_CHOICE, EFFECT_COMPOUND } from "../../types/effectTypes.js";
import type { EffectResolutionResult } from "../effects/index.js";
import {
  applyChoiceOutcome,
  buildChoiceRequiredEvent,
  getChoiceOptionsFromEffect,
  type ChoiceOptionsResult,
  type PendingChoiceSource,
} from "./choice/choiceResolution.js";

const INTERACTIVE_ONCE_PER_ROUND = new Set([SKILL_ARYTHEA_RITUAL_OF_PAIN]);

export { USE_SKILL_COMMAND };

export interface UseSkillCommandParams {
  readonly playerId: string;
  readonly skillId: SkillId;
}

/**
 * Apply the skill effect based on skill ID.
 * Returns updated state with skill effects applied.
 *
 * This handles skills with custom effect handlers.
 * Skills with generic `effect` properties are handled separately.
 */
function applyCustomSkillEffect(
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

    case SKILL_ARYTHEA_POLARIZATION:
      return applyPolarizationEffect(state, playerId);

    default:
      // Skill has no custom handler - will use generic effect resolution
      return state;
  }
}

/**
 * Remove the skill effect for undo.
 * Returns updated state with skill effects removed.
 *
 * This handles skills with custom effect handlers.
 */
function removeCustomSkillEffect(
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

    case SKILL_ARYTHEA_POLARIZATION:
      return removePolarizationEffect(state, playerId);

    default:
      return state;
  }
}

/**
 * Check if a skill has a custom effect handler.
 */
function hasCustomHandler(skillId: SkillId): boolean {
  return [
    SKILL_TOVAK_WHO_NEEDS_MAGIC,
    SKILL_TOVAK_SHIELD_MASTERY,
    SKILL_TOVAK_I_FEEL_NO_PAIN,
    SKILL_ARYTHEA_POLARIZATION,
  ].includes(skillId);
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
  if (
    usageType === SKILL_USAGE_ONCE_PER_ROUND ||
    (usageType === SKILL_USAGE_INTERACTIVE &&
      INTERACTIVE_ONCE_PER_ROUND.has(skillId))
  ) {
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
  if (
    usageType === SKILL_USAGE_ONCE_PER_ROUND ||
    (usageType === SKILL_USAGE_INTERACTIVE &&
      INTERACTIVE_ONCE_PER_ROUND.has(skillId))
  ) {
    return {
      ...cooldowns,
      usedThisRound: cooldowns.usedThisRound.filter((id) => id !== skillId),
    };
  }
  return cooldowns;
}

/**
 * Handle choice effect by setting up pending choice state.
 */
function handleSkillChoiceEffect(
  playerId: string,
  playerIndex: number,
  skillId: SkillId,
  effectResult: EffectResolutionResult,
  choiceInfo: ChoiceOptionsResult
): CommandResult {
  const source: PendingChoiceSource = {
    cardId: null,
    skillId,
    unitInstanceId: null,
  };

  const resolveRemainingEffects = (
    currentState: GameState,
    remainingEffects: readonly CardEffect[] | undefined
  ): CommandResult => {
    if (!remainingEffects || remainingEffects.length === 0) {
      return {
        state: currentState,
        events: [createSkillUsedEvent(playerId, skillId)],
      };
    }

    const compoundEffect = {
      type: EFFECT_COMPOUND,
      effects: remainingEffects,
    } as const;
    const compoundResult = resolveEffect(currentState, playerId, compoundEffect);

    if (compoundResult.requiresChoice) {
      const nextChoiceInfo = getChoiceOptionsFromEffect(
        compoundResult,
        compoundEffect
      );

      if (nextChoiceInfo) {
        return handleSkillChoiceEffect(
          playerId,
          playerIndex,
          skillId,
          compoundResult,
          nextChoiceInfo
        );
      }
    }

    return {
      state: compoundResult.state,
      events: [createSkillUsedEvent(playerId, skillId)],
    };
  };

  return applyChoiceOutcome({
    state: effectResult.state,
    playerId,
    playerIndex,
    options: choiceInfo.options,
    source,
    remainingEffects: choiceInfo.remainingEffects,
    resolveEffect: (state, id, effect) => resolveEffect(state, id, effect),
    handlers: {
      onNoOptions: (state) =>
        resolveRemainingEffects(state, choiceInfo.remainingEffects),
      onAutoResolved: (autoResult) =>
        resolveRemainingEffects(autoResult.state, choiceInfo.remainingEffects),
      onPendingChoice: (stateWithChoice, options) => ({
        state: stateWithChoice,
        events: [
          createSkillUsedEvent(playerId, skillId),
          buildChoiceRequiredEvent(playerId, source, options),
        ],
      }),
    },
  });
}

/**
 * Create a use skill command.
 */
export function createUseSkillCommand(params: UseSkillCommandParams): Command {
  const { playerId, skillId } = params;

  // Store the effect that was applied so we can reverse it on undo
  let appliedEffect: CardEffect | null = null;

  return {
    type: USE_SKILL_COMMAND,
    playerId,
    isReversible: true, // Skills can be undone within the same turn

    execute(state: GameState): CommandResult {
      const skill = SKILLS[skillId];
      if (!skill) {
        throw new Error(`Skill not found: ${skillId}`);
      }

      const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
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

      // Check if skill has a custom handler
      if (hasCustomHandler(skillId)) {
        updatedState = applyCustomSkillEffect(updatedState, playerId, skillId);
        return {
          state: updatedState,
          events: [createSkillUsedEvent(playerId, skillId)],
        };
      }

      // Check if skill has a generic effect defined
      if (skill.effect) {
        appliedEffect = skill.effect;

        // Resolve the effect using the standard effect resolution system
        const effectResult = resolveEffect(updatedState, playerId, skill.effect);

        // Check if this is a choice effect
        if (effectResult.requiresChoice) {
          const choiceInfo = getChoiceOptionsFromEffect(effectResult, skill.effect);

          if (choiceInfo) {
            return handleSkillChoiceEffect(
              playerId,
              playerIndex,
              skillId,
              effectResult,
              choiceInfo
            );
          }
        }

        // No choice required - return final state
        return {
          state: effectResult.state,
          events: [createSkillUsedEvent(playerId, skillId)],
        };
      }

      // No effect defined - just apply cooldown
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

      const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
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
      let updatedPlayer: Player = {
        ...player,
        skillCooldowns: updatedCooldowns,
        pendingChoice: null, // Clear any pending choice
      };

      // Check if skill has a custom handler
      if (hasCustomHandler(skillId)) {
        const players = [...state.players];
        players[playerIndex] = updatedPlayer;
        let updatedState: GameState = { ...state, players };
        updatedState = removeCustomSkillEffect(updatedState, playerId, skillId);
        return {
          state: updatedState,
          events: [],
        };
      }

      // Reverse the generic effect if one was applied (only if it wasn't a choice effect)
      if (appliedEffect && appliedEffect.type !== EFFECT_CHOICE) {
        updatedPlayer = reverseEffect(updatedPlayer, appliedEffect);
      }

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      return {
        state: { ...state, players },
        events: [],
      };
    },
  };
}
