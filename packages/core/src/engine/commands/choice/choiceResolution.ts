/**
 * Shared choice resolution helpers
 *
 * Centralizes choice option extraction, resolvability filtering, and
 * pending choice setup across card plays, skills, units, and choice resolution.
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player, PendingChoice } from "../../../types/player.js";
import type {
  CardEffect,
  ChoiceEffect,
  CompoundEffect,
} from "../../../types/cards.js";
import type { GameEvent, CardId, SkillId } from "@mage-knight/shared";
import { createChoiceRequiredEvent } from "@mage-knight/shared";
import {
  EFFECT_CARD_BOOST,
  EFFECT_CHOICE,
  EFFECT_COMPOUND,
  EFFECT_CONVERT_MANA_TO_CRYSTAL,
  EFFECT_GAIN_ATTACK,
  EFFECT_MANA_DRAW_PICK_DIE,
  EFFECT_MANA_DRAW_POWERED,
  EFFECT_MANA_DRAW_SET_COLOR,
  EFFECT_READY_UNIT,
  EFFECT_SELECT_COMBAT_ENEMY,
  EFFECT_SOURCE_OPENING_REROLL,
  EFFECT_SPELL_FORGE_BASIC,
  EFFECT_SPELL_FORGE_POWERED,
  EFFECT_RESOLVE_SPELL_FORGE_CRYSTAL,
} from "../../../types/effectTypes.js";
import { describeEffect, isEffectResolvable } from "../../effects/index.js";
import type { EffectResolutionResult } from "../../effects/index.js";

export interface ChoiceOptionsResult {
  readonly options: readonly CardEffect[];
  readonly remainingEffects?: readonly CardEffect[];
}

export interface PendingChoiceSource {
  readonly cardId: CardId | null;
  readonly skillId: SkillId | null;
  readonly unitInstanceId: string | null;
}

export interface ChoiceHandlingResult {
  readonly state: GameState;
  readonly events: GameEvent[];
  /** The effect that was actually resolved (for undo tracking) */
  readonly resolvedEffect?: CardEffect;
}

export interface ChoiceOutcomeHandlers {
  readonly onNoOptions: (state: GameState) => ChoiceHandlingResult;
  readonly onAutoResolved: (
    result: EffectResolutionResult,
    resolvedEffect: CardEffect
  ) => ChoiceHandlingResult;
  readonly onPendingChoice: (
    state: GameState,
    options: readonly CardEffect[],
    pendingChoice: PendingChoice
  ) => ChoiceHandlingResult;
}

const DYNAMIC_CHOICE_EFFECTS = new Set<string>([
  EFFECT_CARD_BOOST,
  EFFECT_CONVERT_MANA_TO_CRYSTAL,
  EFFECT_GAIN_ATTACK,
  EFFECT_MANA_DRAW_POWERED,
  EFFECT_MANA_DRAW_PICK_DIE,
  EFFECT_MANA_DRAW_SET_COLOR,
  EFFECT_READY_UNIT,
  EFFECT_SELECT_COMBAT_ENEMY,
  EFFECT_SOURCE_OPENING_REROLL,
  EFFECT_SPELL_FORGE_BASIC,
  EFFECT_SPELL_FORGE_POWERED,
  EFFECT_RESOLVE_SPELL_FORGE_CRYSTAL,
]);

function buildPendingChoice(
  source: PendingChoiceSource,
  options: readonly CardEffect[],
  remainingEffects?: readonly CardEffect[]
): PendingChoice {
  return {
    cardId: source.cardId,
    skillId: source.skillId,
    unitInstanceId: source.unitInstanceId,
    options,
    ...(remainingEffects && { remainingEffects }),
  };
}

function findChoiceIndex(effects: readonly CardEffect[]): number | null {
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i];
    if (!effect) {
      continue;
    }
    if (effect.type === EFFECT_CHOICE || DYNAMIC_CHOICE_EFFECTS.has(effect.type)) {
      return i;
    }
  }
  return null;
}

function setPendingChoice(
  state: GameState,
  playerIndex: number,
  pendingChoice: PendingChoice
): GameState {
  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  const playerWithChoice: Player = {
    ...player,
    pendingChoice,
  };

  const playersWithChoice = [...state.players];
  playersWithChoice[playerIndex] = playerWithChoice;

  return { ...state, players: playersWithChoice };
}

/**
 * Determine the choice options from an effect resolution result.
 * Returns the options array, or null if this isn't a choice scenario.
 */
export function getChoiceOptionsFromEffect(
  effectResult: { dynamicChoiceOptions?: readonly CardEffect[] },
  effectToApply: CardEffect
): ChoiceOptionsResult | null {
  if (effectResult.dynamicChoiceOptions) {
    // Dynamic choices from effects like card boost or mana draw
    if (effectToApply.type === EFFECT_COMPOUND) {
      const compoundEffect = effectToApply as CompoundEffect;
      const choiceIndex = findChoiceIndex(compoundEffect.effects);
      if (choiceIndex !== null) {
        const remainingEffects = compoundEffect.effects.slice(choiceIndex + 1);
        if (remainingEffects.length > 0) {
          return {
            options: effectResult.dynamicChoiceOptions,
            remainingEffects,
          };
        }
      }
    }

    return { options: effectResult.dynamicChoiceOptions };
  }

  if (effectToApply.type === EFFECT_CHOICE) {
    // Static choice effect
    const choiceEffect = effectToApply as ChoiceEffect;
    return { options: choiceEffect.options };
  }

  if (effectToApply.type === EFFECT_COMPOUND) {
    const compoundEffect = effectToApply as CompoundEffect;
    for (let i = 0; i < compoundEffect.effects.length; i++) {
      const subEffect = compoundEffect.effects[i];
      if (subEffect && subEffect.type === EFFECT_CHOICE) {
        const choiceEffect = subEffect as ChoiceEffect;
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
 * Filter choice options to only those that are currently resolvable.
 */
export function filterResolvableOptions(
  state: GameState,
  playerId: string,
  options: readonly CardEffect[]
): readonly CardEffect[] {
  return options.filter((opt) => isEffectResolvable(state, playerId, opt));
}

/**
 * Build a CHOICE_REQUIRED event with option descriptions.
 */
export function buildChoiceRequiredEvent(
  playerId: string,
  source: PendingChoiceSource,
  options: readonly CardEffect[]
): GameEvent {
  return createChoiceRequiredEvent(
    playerId,
    source.cardId,
    source.skillId,
    options.map((opt) => describeEffect(opt))
  );
}

/**
 * Apply standard choice outcome logic (0/1/many options).
 */
export function applyChoiceOutcome(params: {
  state: GameState;
  playerId: string;
  playerIndex: number;
  options: readonly CardEffect[];
  source: PendingChoiceSource;
  remainingEffects?: readonly CardEffect[];
  resolveEffect: (
    state: GameState,
    playerId: string,
    effect: CardEffect
  ) => EffectResolutionResult;
  handlers: ChoiceOutcomeHandlers;
}): ChoiceHandlingResult {
  const {
    state,
    playerId,
    playerIndex,
    options,
    source,
    remainingEffects,
    resolveEffect,
    handlers,
  } = params;

  const resolvableOptions = filterResolvableOptions(state, playerId, options);

  if (resolvableOptions.length === 0) {
    return handlers.onNoOptions(state);
  }

  if (resolvableOptions.length === 1) {
    const singleOption = resolvableOptions[0];
    if (!singleOption) {
      throw new Error("Expected single resolvable option");
    }

    const autoResolveResult = resolveEffect(state, playerId, singleOption);
    const result = handlers.onAutoResolved(autoResolveResult, singleOption);

    return {
      ...result,
      resolvedEffect: singleOption,
    };
  }

  const pendingChoice = buildPendingChoice(
    source,
    resolvableOptions,
    remainingEffects
  );
  const stateWithChoice = setPendingChoice(state, playerIndex, pendingChoice);

  return handlers.onPendingChoice(stateWithChoice, resolvableOptions, pendingChoice);
}
