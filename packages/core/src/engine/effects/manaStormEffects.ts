/**
 * Mana Storm effect handlers
 *
 * Implements the Mana Storm advanced action card:
 *
 * Basic: Choose a mana die in the Source showing a basic color.
 * Gain a crystal of that color, then immediately reroll that die
 * and return it to the Source.
 *
 * Powered: Reroll all dice in the Source. You can use three extra dice
 * from the Source, and you can use dice showing black or gold as mana
 * of any basic color, regardless of the Round.
 *
 * Flow diagram (basic):
 * ```
 * MANA_STORM_BASIC (entry point)
 *   ├─ Only 1 basic die available? → auto-select
 *   └─ Multiple basic dice? → MANA_STORM_SELECT_DIE (player chooses)
 *         ↓
 *      Gain crystal of die color, reroll die → done
 * ```
 *
 * Flow diagram (powered):
 * ```
 * MANA_STORM_POWERED (entry point)
 *   → Reroll all dice in source (RNG)
 *   → Apply 3x RULE_EXTRA_SOURCE_DIE modifiers
 *   → Apply RULE_BLACK_AS_ANY_COLOR modifier
 *   → Apply RULE_GOLD_AS_ANY_COLOR modifier
 *   → done
 * ```
 */

import type { GameState } from "../../state/GameState.js";
import type { ManaStormSelectDieEffect } from "../../types/cards.js";
import type { SourceDieId } from "../../types/mana.js";
import type { EffectResolutionResult } from "./types.js";
import { BASIC_MANA_COLORS, CARD_MANA_STORM } from "@mage-knight/shared";
import type { BasicManaColor, ManaColor } from "@mage-knight/shared";
import {
  EFFECT_MANA_STORM_BASIC,
  EFFECT_MANA_STORM_SELECT_DIE,
  EFFECT_MANA_STORM_POWERED,
} from "../../types/effectTypes.js";
import {
  EFFECT_RULE_OVERRIDE,
  RULE_EXTRA_SOURCE_DIE,
  RULE_BLACK_AS_ANY_COLOR,
  RULE_GOLD_AS_ANY_COLOR,
  DURATION_TURN,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { applyGainCrystal } from "./atomicResourceEffects.js";
import { rerollDie } from "../mana/manaSource.js";
import { addModifier } from "../modifiers/lifecycle.js";

/**
 * Check if a mana color is a basic color (red, blue, green, white).
 */
function isBasicColor(color: ManaColor): color is BasicManaColor {
  return (BASIC_MANA_COLORS as readonly ManaColor[]).includes(color);
}

// ============================================================================
// BASIC EFFECT
// ============================================================================

/**
 * Entry point for Mana Storm basic effect.
 * Filters source dice to those showing basic colors and presents choice.
 */
function handleManaStormBasic(state: GameState): EffectResolutionResult {
  // Filter dice showing basic colors that are available
  const basicDice = state.source.dice.filter(
    (d) =>
      d.takenByPlayerId === null &&
      !d.isDepleted &&
      isBasicColor(d.color)
  );

  if (basicDice.length === 0) {
    return {
      state,
      description: "No dice showing basic colors in the Source",
    };
  }

  // Auto-select if only one basic die available
  if (basicDice.length === 1) {
    const die = basicDice[0]!;
    const selectOptions: ManaStormSelectDieEffect[] = [
      {
        type: EFFECT_MANA_STORM_SELECT_DIE,
        dieId: die.id,
        dieColor: die.color as BasicManaColor,
      },
    ];
    return {
      state,
      description: `Gain ${die.color} crystal and reroll die`,
      requiresChoice: true,
      dynamicChoiceOptions: selectOptions,
    };
  }

  // Multiple basic dice — player chooses which one
  const dieOptions: ManaStormSelectDieEffect[] = basicDice.map((die) => ({
    type: EFFECT_MANA_STORM_SELECT_DIE,
    dieId: die.id,
    dieColor: die.color as BasicManaColor,
  }));

  return {
    state,
    description: "Choose a die showing a basic color from the Source",
    requiresChoice: true,
    dynamicChoiceOptions: dieOptions,
  };
}

/**
 * Handle die selection for Mana Storm basic effect.
 * Gains a crystal of the die's color and rerolls the die.
 */
function handleManaStormSelectDie(
  state: GameState,
  playerId: string,
  effect: ManaStormSelectDieEffect
): EffectResolutionResult {
  const { dieId, dieColor } = effect;
  const { playerIndex, player } = getPlayerContext(state, playerId);

  // 1. Gain crystal of the die's color
  const crystalResult = applyGainCrystal(state, playerIndex, player, dieColor);
  let updatedState = crystalResult.state;

  // 2. Reroll the die and return it to source
  const { source: rerolledSource, rng: newRng } = rerollDie(
    updatedState.source,
    dieId as SourceDieId,
    updatedState.timeOfDay,
    updatedState.rng
  );

  updatedState = {
    ...updatedState,
    source: rerolledSource,
    rng: newRng,
  };

  return {
    state: updatedState,
    description: `Gained ${dieColor} crystal, rerolled die`,
  };
}

// ============================================================================
// POWERED EFFECT
// ============================================================================

/**
 * Handle Mana Storm powered effect.
 * 1. Reroll ALL dice in the source
 * 2. Apply 3x RULE_EXTRA_SOURCE_DIE modifiers (3 extra dice usage)
 * 3. Apply RULE_BLACK_AS_ANY_COLOR modifier
 * 4. Apply RULE_GOLD_AS_ANY_COLOR modifier
 */
function handleManaStormPowered(
  state: GameState,
  playerId: string
): EffectResolutionResult {
  let updatedState = state;
  let currentRng = state.rng;

  // 1. Reroll ALL dice in the source
  for (const die of state.source.dice) {
    const { source: rerolledSource, rng: newRng } = rerollDie(
      updatedState.source,
      die.id,
      updatedState.timeOfDay,
      currentRng
    );
    updatedState = { ...updatedState, source: rerolledSource };
    currentRng = newRng;
  }
  updatedState = { ...updatedState, rng: currentRng };

  // 2. Apply 3 extra source die modifiers (stacked)
  const modifierBase = {
    source: { type: SOURCE_CARD as const, cardId: CARD_MANA_STORM, playerId },
    duration: DURATION_TURN as const,
    scope: { type: SCOPE_SELF as const },
    createdAtRound: updatedState.round,
    createdByPlayerId: playerId,
  };

  for (let i = 0; i < 3; i++) {
    updatedState = addModifier(updatedState, {
      ...modifierBase,
      effect: { type: EFFECT_RULE_OVERRIDE, rule: RULE_EXTRA_SOURCE_DIE },
    });
  }

  // 3. Apply black-as-any-color modifier
  updatedState = addModifier(updatedState, {
    ...modifierBase,
    effect: { type: EFFECT_RULE_OVERRIDE, rule: RULE_BLACK_AS_ANY_COLOR },
  });

  // 4. Apply gold-as-any-color modifier
  updatedState = addModifier(updatedState, {
    ...modifierBase,
    effect: { type: EFFECT_RULE_OVERRIDE, rule: RULE_GOLD_AS_ANY_COLOR },
  });

  return {
    state: updatedState,
    description:
      "Rerolled all source dice, can use 3 extra dice, black/gold as any basic color",
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register all Mana Storm effect handlers with the effect registry.
 * Called during effect system initialization.
 */
export function registerManaStormEffects(): void {
  registerEffect(EFFECT_MANA_STORM_BASIC, (state, _playerId, _effect) => {
    return handleManaStormBasic(state);
  });

  registerEffect(EFFECT_MANA_STORM_SELECT_DIE, (state, playerId, effect) => {
    return handleManaStormSelectDie(
      state,
      playerId,
      effect as ManaStormSelectDieEffect
    );
  });

  registerEffect(EFFECT_MANA_STORM_POWERED, (state, playerId, _effect) => {
    return handleManaStormPowered(state, playerId);
  });
}
