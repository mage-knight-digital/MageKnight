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

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { Player, SkillCooldowns } from "../../types/player.js";
import type { SkillId, ManaSourceInfo } from "@mage-knight/shared";
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
  SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
  SKILL_ARYTHEA_POLARIZATION,
  SKILL_ARYTHEA_RITUAL_OF_PAIN,
  SKILL_ARYTHEA_POWER_OF_PAIN,
  SKILL_ARYTHEA_INVOCATION,
  SKILL_TOVAK_MANA_OVERLOAD,
  SKILL_GOLDYX_UNIVERSAL_POWER,
  SKILL_BRAEVALAR_SHAPESHIFT,
  SKILL_BRAEVALAR_REGENERATE,
  SKILL_KRANG_REGENERATE,
  SKILL_KRANG_MASTER_OF_CHAOS,
  SKILL_WOLFHAWK_HAWK_EYES,
  SKILL_WOLFHAWK_DEADLY_AIM,
  SKILL_WOLFHAWK_KNOW_YOUR_PREY,
  SKILL_WOLFHAWK_DUELING,
  SKILL_WOLFHAWK_WOLFS_HOWL,
  SKILL_KRANG_PUPPET_MASTER,
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
  applyPowerOfPainEffect,
  removePowerOfPainEffect,
  applyInvocationEffect,
  removeInvocationEffect,
  applyIDontGiveADamnEffect,
  removeIDontGiveADamnEffect,
  applyManaOverloadEffect,
  removeManaOverloadEffect,
  applyUniversalPowerEffect,
  removeUniversalPowerEffect,
  applyShapeshiftEffect,
  removeShapeshiftEffect,
  applyRegenerateEffect,
  applyKrangRegenerateEffect,
  removeRegenerateEffect,
  removeKrangRegenerateEffect,
  applyHawkEyesEffect,
  removeHawkEyesEffect,
  applyDeadlyAimEffect,
  removeDeadlyAimEffect,
  applyKnowYourPreyEffect,
  removeKnowYourPreyEffect,
  applyDuelingEffect,
  removeDuelingEffect,
  applyWolfsHowlEffect,
  removeWolfsHowlEffect,
  applyPuppetMasterEffect,
  removePuppetMasterEffect,
} from "./skills/index.js";
import { getPlayerIndexByIdOrThrow } from "../helpers/playerHelpers.js";
import { restoreMana } from "./helpers/manaConsumptionHelpers.js";
import {
  resolveEffect,
  reverseEffect,
} from "../effects/index.js";
import { evaluateScalingFactor } from "../effects/scalingEvaluator.js";
import type { CardEffect } from "../../types/cards.js";
import { EFFECT_CHOICE, EFFECT_COMPOUND, EFFECT_CONDITIONAL, EFFECT_DRAW_CARDS, EFFECT_SCALING, EFFECT_TAKE_WOUND } from "../../types/effectTypes.js";
import type { ScalingEffect as ScalingEffectType } from "../../types/cards.js";
import type { EffectResolutionResult } from "../effects/index.js";
import {
  applyChoiceOutcome,
  buildChoiceRequiredEvent,
  getChoiceOptionsFromEffect,
  type ChoiceOptionsResult,
  type PendingChoiceSource,
} from "./choice/choiceResolution.js";

import { SKILL_NOROWAS_PRAYER_OF_WEATHER } from "../../data/skills/index.js";
import { isMotivationSkill, ALL_MOTIVATION_SKILLS } from "../rules/motivation.js";
import {
  canUseMasterOfChaosFreeRotate,
  createMasterOfChaosState,
  getMasterOfChaosEffectForPosition,
  getMasterOfChaosPosition,
  rotateMasterOfChaosPosition,
} from "../rules/masterOfChaos.js";

import { SKILL_GOLDYX_SOURCE_OPENING } from "../../data/skills/index.js";

const INTERACTIVE_ONCE_PER_ROUND = new Set([SKILL_ARYTHEA_RITUAL_OF_PAIN, SKILL_TOVAK_MANA_OVERLOAD, SKILL_NOROWAS_PRAYER_OF_WEATHER, SKILL_GOLDYX_SOURCE_OPENING, SKILL_WOLFHAWK_WOLFS_HOWL]);

/**
 * Check if an effect (or any sub-effect in a compound) contains non-reversible
 * effects like drawing cards or taking wounds. Commands with such effects must
 * be marked isReversible: false to prevent undo exploits.
 */
function effectContainsIrreversible(effect: CardEffect): boolean {
  if (effect.type === EFFECT_DRAW_CARDS || effect.type === EFFECT_TAKE_WOUND || effect.type === EFFECT_CONDITIONAL) {
    return true;
  }
  if (effect.type === EFFECT_COMPOUND) {
    const compound = effect as import("../../types/cards.js").CompoundEffect;
    return compound.effects.some(effectContainsIrreversible);
  }
  return false;
}

export { USE_SKILL_COMMAND };

export interface UseSkillCommandParams {
  readonly playerId: string;
  readonly skillId: SkillId;
  readonly manaSource?: ManaSourceInfo;
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
  skillId: SkillId,
  manaSource?: ManaSourceInfo
): GameState {
  switch (skillId) {
    case SKILL_TOVAK_WHO_NEEDS_MAGIC:
      return applyWhoNeedsMagicEffect(state, playerId);

    case SKILL_TOVAK_SHIELD_MASTERY:
      return applyShieldMasteryEffect(state, playerId);

    case SKILL_TOVAK_I_FEEL_NO_PAIN:
      return applyIFeelNoPainEffect(state, playerId);

    case SKILL_TOVAK_I_DONT_GIVE_A_DAMN:
      return applyIDontGiveADamnEffect(state, playerId);

    case SKILL_ARYTHEA_POLARIZATION:
      return applyPolarizationEffect(state, playerId);

    case SKILL_ARYTHEA_POWER_OF_PAIN:
      return applyPowerOfPainEffect(state, playerId);

    case SKILL_ARYTHEA_INVOCATION:
      return applyInvocationEffect(state, playerId);

    case SKILL_TOVAK_MANA_OVERLOAD:
      return applyManaOverloadEffect(state, playerId);

    case SKILL_GOLDYX_UNIVERSAL_POWER:
      return applyUniversalPowerEffect(state, playerId, manaSource);

    case SKILL_BRAEVALAR_SHAPESHIFT:
      return applyShapeshiftEffect(state, playerId);

    case SKILL_BRAEVALAR_REGENERATE:
      return applyRegenerateEffect(state, playerId, manaSource);

    case SKILL_KRANG_REGENERATE:
      return applyKrangRegenerateEffect(state, playerId, manaSource);

    case SKILL_WOLFHAWK_HAWK_EYES:
      return applyHawkEyesEffect(state, playerId);

    case SKILL_WOLFHAWK_DEADLY_AIM:
      return applyDeadlyAimEffect(state, playerId);

    case SKILL_WOLFHAWK_KNOW_YOUR_PREY:
      return applyKnowYourPreyEffect(state, playerId);

    case SKILL_WOLFHAWK_DUELING:
      return applyDuelingEffect(state, playerId);

    case SKILL_WOLFHAWK_WOLFS_HOWL:
      return applyWolfsHowlEffect(state, playerId);

    case SKILL_KRANG_PUPPET_MASTER:
      return applyPuppetMasterEffect(state, playerId);

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

    case SKILL_TOVAK_I_DONT_GIVE_A_DAMN:
      return removeIDontGiveADamnEffect(state, playerId);

    case SKILL_ARYTHEA_POLARIZATION:
      return removePolarizationEffect(state, playerId);

    case SKILL_ARYTHEA_POWER_OF_PAIN:
      return removePowerOfPainEffect(state, playerId);

    case SKILL_ARYTHEA_INVOCATION:
      return removeInvocationEffect(state, playerId);

    case SKILL_TOVAK_MANA_OVERLOAD:
      return removeManaOverloadEffect(state, playerId);

    case SKILL_GOLDYX_UNIVERSAL_POWER:
      return removeUniversalPowerEffect(state, playerId);

    case SKILL_BRAEVALAR_SHAPESHIFT:
      return removeShapeshiftEffect(state, playerId);

    case SKILL_BRAEVALAR_REGENERATE:
      return removeRegenerateEffect(state, playerId);

    case SKILL_KRANG_REGENERATE:
      return removeKrangRegenerateEffect(state, playerId);

    case SKILL_WOLFHAWK_HAWK_EYES:
      return removeHawkEyesEffect(state, playerId);

    case SKILL_WOLFHAWK_DEADLY_AIM:
      return removeDeadlyAimEffect(state, playerId);

    case SKILL_WOLFHAWK_KNOW_YOUR_PREY:
      return removeKnowYourPreyEffect(state, playerId);

    case SKILL_WOLFHAWK_DUELING:
      return removeDuelingEffect(state, playerId);

    case SKILL_WOLFHAWK_WOLFS_HOWL:
      return removeWolfsHowlEffect(state, playerId);

    case SKILL_KRANG_PUPPET_MASTER:
      return removePuppetMasterEffect(state, playerId);

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
    SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
    SKILL_ARYTHEA_POLARIZATION,
    SKILL_ARYTHEA_POWER_OF_PAIN,
    SKILL_ARYTHEA_INVOCATION,
    SKILL_TOVAK_MANA_OVERLOAD,
    SKILL_GOLDYX_UNIVERSAL_POWER,
    SKILL_BRAEVALAR_SHAPESHIFT,
    SKILL_BRAEVALAR_REGENERATE,
    SKILL_KRANG_REGENERATE,
    SKILL_WOLFHAWK_HAWK_EYES,
    SKILL_WOLFHAWK_DEADLY_AIM,
    SKILL_WOLFHAWK_KNOW_YOUR_PREY,
    SKILL_WOLFHAWK_DUELING,
    SKILL_WOLFHAWK_WOLFS_HOWL,
    SKILL_KRANG_PUPPET_MASTER,
  ].includes(skillId);
}

/**
 * Add a skill to the appropriate cooldown tracker based on usage type.
 * Motivation skills also set activeUntilNextTurn for cross-hero cooldown.
 */
function addToCooldowns(
  cooldowns: SkillCooldowns,
  skillId: SkillId,
  usageType: string
): SkillCooldowns {
  let updated = cooldowns;

  if (usageType === SKILL_USAGE_ONCE_PER_TURN) {
    updated = {
      ...updated,
      usedThisTurn: [...updated.usedThisTurn, skillId],
    };
  } else if (
    usageType === SKILL_USAGE_ONCE_PER_ROUND ||
    (usageType === SKILL_USAGE_INTERACTIVE &&
      INTERACTIVE_ONCE_PER_ROUND.has(skillId))
  ) {
    updated = {
      ...updated,
      usedThisRound: [...updated.usedThisRound, skillId],
    };
  }

  // Motivation cross-hero cooldown: block all Motivation skills until end of next turn
  if (isMotivationSkill(skillId)) {
    updated = {
      ...updated,
      activeUntilNextTurn: [
        ...updated.activeUntilNextTurn,
        ...ALL_MOTIVATION_SKILLS.filter(
          (id) => !updated.activeUntilNextTurn.includes(id)
        ),
      ],
    };
  }

  return updated;
}

/**
 * Remove a skill from the appropriate cooldown tracker for undo.
 */
function removeFromCooldowns(
  cooldowns: SkillCooldowns,
  skillId: SkillId,
  usageType: string
): SkillCooldowns {
  let updated = cooldowns;

  if (usageType === SKILL_USAGE_ONCE_PER_TURN) {
    updated = {
      ...updated,
      usedThisTurn: updated.usedThisTurn.filter((id) => id !== skillId),
    };
  } else if (
    usageType === SKILL_USAGE_ONCE_PER_ROUND ||
    (usageType === SKILL_USAGE_INTERACTIVE &&
      INTERACTIVE_ONCE_PER_ROUND.has(skillId))
  ) {
    updated = {
      ...updated,
      usedThisRound: updated.usedThisRound.filter((id) => id !== skillId),
    };
  }

  // Remove Motivation cross-hero cooldown on undo
  if (isMotivationSkill(skillId)) {
    updated = {
      ...updated,
      activeUntilNextTurn: updated.activeUntilNextTurn.filter(
        (id) => !isMotivationSkill(id)
      ),
    };
  }

  return updated;
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

  // Snapshot of activeModifiers before effect resolution, restored on undo
  // to remove any modifiers added by EFFECT_APPLY_MODIFIER sub-effects
  let preEffectModifiers: GameState["activeModifiers"] | null = null;
  let previousMasterOfChaosPlayerState: Player | null = null;

  // Check if the skill's effect contains non-reversible sub-effects (e.g., draw cards).
  // If so, the command sets an undo checkpoint to prevent exploit via undo+reuse.
  // Custom handlers that draw cards must also be marked non-reversible.
  const skill = SKILLS[skillId];
  const IRREVERSIBLE_CUSTOM_SKILLS = [
    SKILL_BRAEVALAR_REGENERATE,
    SKILL_KRANG_REGENERATE,
  ];
  const isReversible =
    !IRREVERSIBLE_CUSTOM_SKILLS.includes(skillId) &&
    !(skill?.effect && effectContainsIrreversible(skill.effect));

  return {
    type: USE_SKILL_COMMAND,
    playerId,
    isReversible,

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

      const isMasterOfChaosSkill = skillId === SKILL_KRANG_MASTER_OF_CHAOS;
      const useMasterOfChaosFreeRotate =
        isMasterOfChaosSkill && canUseMasterOfChaosFreeRotate(state, player);

      const updatedCooldowns = useMasterOfChaosFreeRotate
        ? player.skillCooldowns
        : addToCooldowns(player.skillCooldowns, skillId, skill.usageType);

      // Update player with new cooldowns
      let updatedPlayer: Player = {
        ...player,
        skillCooldowns: updatedCooldowns,
      };

      if (isMasterOfChaosSkill) {
        previousMasterOfChaosPlayerState = player;
        const rotatedPosition = rotateMasterOfChaosPosition(
          getMasterOfChaosPosition(player)
        );

        updatedPlayer = {
          ...updatedPlayer,
          masterOfChaosState: createMasterOfChaosState(rotatedPosition, false),
        };

        const players = [...state.players];
        players[playerIndex] = updatedPlayer;
        const rotatedState: GameState = { ...state, players };

        if (useMasterOfChaosFreeRotate) {
          return {
            state: rotatedState,
            events: [createSkillUsedEvent(playerId, skillId)],
          };
        }

        const chaosEffect = getMasterOfChaosEffectForPosition(rotatedPosition);
        const effectResult = resolveEffect(rotatedState, playerId, chaosEffect);

        if (effectResult.requiresChoice) {
          const choiceInfo = getChoiceOptionsFromEffect(effectResult, chaosEffect);
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

        return {
          state: effectResult.state,
          events: [createSkillUsedEvent(playerId, skillId)],
        };
      }

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      let updatedState: GameState = { ...state, players };

      // Check if skill has a custom handler
      if (hasCustomHandler(skillId)) {
        updatedState = applyCustomSkillEffect(updatedState, playerId, skillId, params.manaSource);
        return {
          state: updatedState,
          events: [createSkillUsedEvent(playerId, skillId)],
        };
      }

      // Check if skill has a generic effect defined
      if (skill.effect) {
        // For scaling effects, store the resolved base effect (with calculated amount)
        // so undo can reverse the exact amount that was granted
        if (skill.effect.type === EFFECT_SCALING) {
          const scalingEffect = skill.effect as ScalingEffectType;
          const scalingCount = evaluateScalingFactor(updatedState, playerId, scalingEffect.scalingFactor);
          let totalBonus = scalingCount * scalingEffect.amountPerUnit;
          if (scalingEffect.minimum !== undefined) totalBonus = Math.max(scalingEffect.minimum, totalBonus);
          if (scalingEffect.maximum !== undefined) totalBonus = Math.min(scalingEffect.maximum, totalBonus);
          appliedEffect = {
            ...scalingEffect.baseEffect,
            amount: scalingEffect.baseEffect.amount + totalBonus,
          };
        } else {
          appliedEffect = skill.effect;
        }

        // Snapshot modifiers before resolution so undo can restore them
        preEffectModifiers = updatedState.activeModifiers;

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

      if (
        skillId === SKILL_KRANG_MASTER_OF_CHAOS &&
        previousMasterOfChaosPlayerState
      ) {
        const restoredPlayers = [...state.players];
        restoredPlayers[playerIndex] = previousMasterOfChaosPlayerState;
        return {
          state: { ...state, players: restoredPlayers },
          events: [],
        };
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

        // Restore mana if skill consumed mana at activation (Universal Power)
        if (params.manaSource) {
          const pIdx = getPlayerIndexByIdOrThrow(updatedState, playerId);
          const currentPlayer = updatedState.players[pIdx];
          if (currentPlayer) {
            const manaResult = restoreMana(currentPlayer, updatedState.source, params.manaSource);
            const restoredPlayers = [...updatedState.players];
            restoredPlayers[pIdx] = manaResult.player;
            updatedState = { ...updatedState, players: restoredPlayers, source: manaResult.source };
          }
        }

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

      // Restore activeModifiers to pre-effect snapshot if modifiers were added
      const activeModifiers = preEffectModifiers ?? state.activeModifiers;

      return {
        state: { ...state, players, activeModifiers },
        events: [],
      };
    },
  };
}
