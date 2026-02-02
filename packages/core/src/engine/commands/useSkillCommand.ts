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
import type { Player, SkillCooldowns, PendingChoice } from "../../types/player.js";
import type { SkillId } from "@mage-knight/shared";
import type { GameEvent } from "@mage-knight/shared";
import {
  createSkillUsedEvent,
  CHOICE_REQUIRED,
} from "@mage-knight/shared";
import { USE_SKILL_COMMAND } from "./commandTypes.js";
import {
  SKILLS,
  SKILL_USAGE_ONCE_PER_TURN,
  SKILL_USAGE_ONCE_PER_ROUND,
  SKILL_TOVAK_WHO_NEEDS_MAGIC,
  SKILL_TOVAK_SHIELD_MASTERY,
  SKILL_TOVAK_I_FEEL_NO_PAIN,
  SKILL_ARYTHEA_POLARIZATION,
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
  isEffectResolvable,
  describeEffect,
} from "../effects/index.js";
import type { CardEffect, ChoiceEffect, CompoundEffect } from "../../types/cards.js";
import { EFFECT_CHOICE, EFFECT_COMPOUND } from "../../types/effectTypes.js";

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
 * Result of extracting choice info from an effect.
 */
interface ChoiceExtractionResult {
  readonly options: readonly CardEffect[];
  readonly remainingEffects?: readonly CardEffect[];
}

/**
 * Get the choice options from an effect resolution result.
 * Handles both direct choice effects and compound effects that start with a choice.
 * Also returns any remaining effects that should be resolved after the choice.
 */
function getChoiceOptions(
  effectResult: { dynamicChoiceOptions?: readonly CardEffect[] },
  effectToApply: CardEffect
): ChoiceExtractionResult | null {
  if (effectResult.dynamicChoiceOptions) {
    return { options: effectResult.dynamicChoiceOptions };
  }

  if (effectToApply.type === EFFECT_CHOICE) {
    const choiceEffect = effectToApply as ChoiceEffect;
    return { options: choiceEffect.options };
  }

  // For compound effects, find the first choice sub-effect and track remaining effects
  // When a compound effect returns requiresChoice, it means a choice effect
  // in the sequence was reached and needs resolution
  if (effectToApply.type === EFFECT_COMPOUND) {
    const compoundEffect = effectToApply as CompoundEffect;
    for (let i = 0; i < compoundEffect.effects.length; i++) {
      const subEffect = compoundEffect.effects[i];
      if (subEffect && subEffect.type === EFFECT_CHOICE) {
        const choiceEffect = subEffect as ChoiceEffect;
        // Get effects that come after this choice
        const remainingEffects = compoundEffect.effects.slice(i + 1);
        if (remainingEffects.length > 0) {
          return {
            options: choiceEffect.options,
            remainingEffects,
          };
        }
        return {
          options: choiceEffect.options,
        };
      }
    }
  }

  return null;
}

/**
 * Handle choice effect by setting up pending choice state.
 */
function handleSkillChoiceEffect(
  state: GameState,
  playerId: string,
  playerIndex: number,
  skillId: SkillId,
  effectResult: { state: GameState; description: string; dynamicChoiceOptions?: readonly CardEffect[] },
  choiceOptions: readonly CardEffect[],
  remainingEffects?: readonly CardEffect[]
): CommandResult {
  // Filter options to only include resolvable ones
  const resolvableOptions = choiceOptions.filter((opt) =>
    isEffectResolvable(effectResult.state, playerId, opt)
  );

  // If no options are resolvable, skip the choice entirely
  // But still need to process remaining effects if any
  if (resolvableOptions.length === 0) {
    if (remainingEffects && remainingEffects.length > 0) {
      // Continue with remaining effects
      const compoundResult = resolveEffect(effectResult.state, playerId, {
        type: EFFECT_COMPOUND,
        effects: remainingEffects,
      });
      return {
        state: compoundResult.state,
        events: [createSkillUsedEvent(playerId, skillId)],
      };
    }
    return {
      state: effectResult.state,
      events: [createSkillUsedEvent(playerId, skillId)],
    };
  }

  // If only one option is resolvable, auto-resolve it
  if (resolvableOptions.length === 1) {
    const singleOption = resolvableOptions[0];
    if (!singleOption) {
      throw new Error("Expected single resolvable option");
    }

    const autoResolveResult = resolveEffect(effectResult.state, playerId, singleOption);

    // If there are remaining effects, continue resolving them
    if (remainingEffects && remainingEffects.length > 0) {
      const compoundResult = resolveEffect(autoResolveResult.state, playerId, {
        type: EFFECT_COMPOUND,
        effects: remainingEffects,
      });

      // Check if the remaining effects require a choice
      if (compoundResult.requiresChoice) {
        const nextChoiceInfo = getChoiceOptions(compoundResult, {
          type: EFFECT_COMPOUND,
          effects: remainingEffects,
        });

        if (nextChoiceInfo) {
          return handleSkillChoiceEffect(
            compoundResult.state,  // Use current state, not original
            playerId,
            playerIndex,
            skillId,
            compoundResult,
            nextChoiceInfo.options,
            nextChoiceInfo.remainingEffects
          );
        }
      }

      return {
        state: compoundResult.state,
        events: [createSkillUsedEvent(playerId, skillId)],
      };
    }

    return {
      state: autoResolveResult.state,
      events: [createSkillUsedEvent(playerId, skillId)],
    };
  }

  // Multiple options available - present choice to player
  const player = effectResult.state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  const newPendingChoice: PendingChoice = {
    cardId: null,
    skillId,
    unitInstanceId: null,
    options: resolvableOptions,
    ...(remainingEffects && { remainingEffects }),
  };

  const playerWithChoice: Player = {
    ...player,
    pendingChoice: newPendingChoice,
  };

  // Update state with pending choice
  const playersWithChoice = [...effectResult.state.players];
  playersWithChoice[playerIndex] = playerWithChoice;

  const events: GameEvent[] = [
    createSkillUsedEvent(playerId, skillId),
    {
      type: CHOICE_REQUIRED,
      playerId,
      cardId: null,
      skillId,
      options: resolvableOptions.map((opt) => describeEffect(opt)),
    },
  ];

  return {
    state: { ...effectResult.state, players: playersWithChoice },
    events,
  };
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
          const choiceInfo = getChoiceOptions(effectResult, skill.effect);

          if (choiceInfo) {
            return handleSkillChoiceEffect(
              updatedState,
              playerId,
              playerIndex,
              skillId,
              effectResult,
              choiceInfo.options,
              choiceInfo.remainingEffects
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
