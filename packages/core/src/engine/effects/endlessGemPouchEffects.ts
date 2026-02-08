/**
 * Endless Gem Pouch Effect Handlers
 *
 * Handles the basic effect: Roll mana dice and gain crystals based on results.
 * - Basic colors (red/blue/green/white) → gain crystal of that color
 * - Gold → player chooses which basic color crystal
 * - Black → Fame +1 instead of crystal
 */

import type { GameState } from "../../state/GameState.js";
import type {
  RollForCrystalsEffect,
  ResolveCrystalRollChoiceEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { registerEffect } from "./effectRegistry.js";
import {
  EFFECT_ROLL_FOR_CRYSTALS,
  EFFECT_RESOLVE_CRYSTAL_ROLL_CHOICE,
} from "../../types/effectTypes.js";
import { getPlayerContext } from "./effectHelpers.js";
import { applyGainCrystal } from "./atomicResourceEffects.js";
import { applyGainFame } from "./atomicProgressionEffects.js";
import { nextRandom } from "../../utils/rng.js";
import type { ManaColor, BasicManaColor } from "@mage-knight/shared";
import {
  ALL_MANA_COLORS,
  MANA_GOLD,
  MANA_BLACK,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  BASIC_MANA_COLORS,
} from "@mage-knight/shared";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Roll a single mana die and return the color.
 */
function rollManaDie(rng: GameState["rng"]): { color: ManaColor; rng: GameState["rng"] } {
  const { value, rng: newRng } = nextRandom(rng);
  const index = Math.floor(value * ALL_MANA_COLORS.length);
  const color = ALL_MANA_COLORS[index];
  if (!color) {
    const fallbackColor = ALL_MANA_COLORS[0];
    if (!fallbackColor) {
      throw new Error("ALL_MANA_COLORS is empty");
    }
    return { color: fallbackColor, rng: newRng };
  }
  return { color, rng: newRng };
}

/**
 * Check if a mana color is a basic color (red/blue/green/white).
 */
function isBasicColor(color: ManaColor): color is BasicManaColor {
  return (BASIC_MANA_COLORS as readonly string[]).includes(color);
}

/**
 * Apply a single die result: basic color → crystal, black → fame.
 * Returns null for gold (requires player choice).
 */
function applySingleResult(
  state: GameState,
  playerIndex: number,
  color: ManaColor
): { state: GameState; description: string } | null {
  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  if (color === MANA_BLACK) {
    const result = applyGainFame(state, playerIndex, player, 1);
    return { state: result.state, description: `Black → Fame +1` };
  }

  if (isBasicColor(color)) {
    const result = applyGainCrystal(state, playerIndex, player, color);
    return { state: result.state, description: `${color} → ${color} crystal` };
  }

  // Gold requires player choice
  return null;
}

// ============================================================================
// EFFECT HANDLERS
// ============================================================================

/**
 * Roll mana dice and process results.
 * If any gold is rolled, presents a choice for the first gold.
 * Otherwise, applies all results directly.
 */
function handleRollForCrystals(
  state: GameState,
  playerId: string,
  effect: RollForCrystalsEffect
): EffectResolutionResult {
  const { playerIndex } = getPlayerContext(state, playerId);

  let currentRng = state.rng;
  const rollResults: ManaColor[] = [];

  // Roll all dice
  for (let i = 0; i < effect.diceCount; i++) {
    const { color, rng: newRng } = rollManaDie(currentRng);
    currentRng = newRng;
    rollResults.push(color);
  }

  let currentState: GameState = { ...state, rng: currentRng };
  const descriptions: string[] = [];

  // Process each result in order, stopping at first gold for choice
  for (let i = 0; i < rollResults.length; i++) {
    const color = rollResults[i]!;

    if (color === MANA_GOLD) {
      // Collect remaining results (after this gold) to pass along
      const remainingResults = rollResults.slice(i + 1);

      // Present choice for this gold roll
      const options: ResolveCrystalRollChoiceEffect[] = [
        { type: EFFECT_RESOLVE_CRYSTAL_ROLL_CHOICE, chosenColor: MANA_RED, remainingResults },
        { type: EFFECT_RESOLVE_CRYSTAL_ROLL_CHOICE, chosenColor: MANA_BLUE, remainingResults },
        { type: EFFECT_RESOLVE_CRYSTAL_ROLL_CHOICE, chosenColor: MANA_GREEN, remainingResults },
        { type: EFFECT_RESOLVE_CRYSTAL_ROLL_CHOICE, chosenColor: MANA_WHITE, remainingResults },
      ];

      const rollStr = rollResults.join(", ");
      const prevDesc = descriptions.length > 0 ? ` ${descriptions.join(". ")}.` : "";

      return {
        state: currentState,
        description: `Rolled: ${rollStr}.${prevDesc} Choose crystal color for gold roll`,
        requiresChoice: true,
        dynamicChoiceOptions: options,
      };
    }

    // Apply non-gold result
    const result = applySingleResult(currentState, playerIndex, color);
    if (result) {
      currentState = result.state;
      descriptions.push(result.description);
    }
  }

  // No gold rolled — all results applied directly
  const rollStr = rollResults.join(", ");
  return {
    state: currentState,
    description: `Rolled: ${rollStr}. ${descriptions.join(". ")}`,
  };
}

/**
 * Resolve after player chooses a crystal color for a gold roll.
 * Applies the chosen crystal, then processes remaining results.
 */
function handleResolveCrystalRollChoice(
  state: GameState,
  playerId: string,
  effect: ResolveCrystalRollChoiceEffect
): EffectResolutionResult {
  const { playerIndex } = getPlayerContext(state, playerId);

  let currentState = state;
  const descriptions: string[] = [];

  // Apply chosen crystal for the gold roll
  const player = currentState.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }
  const crystalResult = applyGainCrystal(currentState, playerIndex, player, effect.chosenColor);
  currentState = crystalResult.state;
  descriptions.push(`Gold → ${effect.chosenColor} crystal`);

  // Process remaining results
  for (let i = 0; i < effect.remainingResults.length; i++) {
    const color = effect.remainingResults[i]!;

    if (color === MANA_GOLD) {
      // Another gold — present another choice
      const remainingResults = effect.remainingResults.slice(i + 1);

      const options: ResolveCrystalRollChoiceEffect[] = [
        { type: EFFECT_RESOLVE_CRYSTAL_ROLL_CHOICE, chosenColor: MANA_RED, remainingResults },
        { type: EFFECT_RESOLVE_CRYSTAL_ROLL_CHOICE, chosenColor: MANA_BLUE, remainingResults },
        { type: EFFECT_RESOLVE_CRYSTAL_ROLL_CHOICE, chosenColor: MANA_GREEN, remainingResults },
        { type: EFFECT_RESOLVE_CRYSTAL_ROLL_CHOICE, chosenColor: MANA_WHITE, remainingResults },
      ];

      const prevDesc = descriptions.join(". ");

      return {
        state: currentState,
        description: `${prevDesc}. Choose crystal color for gold roll`,
        requiresChoice: true,
        dynamicChoiceOptions: options,
      };
    }

    // Apply non-gold result
    const result = applySingleResult(currentState, playerIndex, color);
    if (result) {
      currentState = result.state;
      descriptions.push(result.description);
    }
  }

  return {
    state: currentState,
    description: descriptions.join(". "),
  };
}

// ============================================================================
// REGISTRATION
// ============================================================================

export function registerEndlessGemPouchEffects(): void {
  registerEffect(EFFECT_ROLL_FOR_CRYSTALS, (state, playerId, effect) => {
    return handleRollForCrystals(state, playerId, effect as RollForCrystalsEffect);
  });

  registerEffect(EFFECT_RESOLVE_CRYSTAL_ROLL_CHOICE, (state, playerId, effect) => {
    return handleResolveCrystalRollChoice(state, playerId, effect as ResolveCrystalRollChoiceEffect);
  });
}
