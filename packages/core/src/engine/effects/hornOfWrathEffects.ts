/**
 * Horn of Wrath Effect Handlers
 *
 * Handles effects for the Horn of Wrath artifact:
 * - RollDieForWound: Roll mana dice and gain wounds for black/red results
 * - ChooseBonusWithRisk: Choose bonus attack amount, then roll dice for wound risk
 * - ResolveBonusChoice: Internal resolver after bonus selection
 */

import type { GameState } from "../../state/GameState.js";
import type {
  RollDieForWoundEffect,
  ChooseBonusWithRiskEffect,
  ResolveBonusChoiceEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { registerEffect } from "./effectRegistry.js";
import {
  EFFECT_ROLL_DIE_FOR_WOUND,
  EFFECT_CHOOSE_BONUS_WITH_RISK,
  EFFECT_RESOLVE_BONUS_CHOICE,
} from "../../types/effectTypes.js";
import { getPlayerContext } from "./effectHelpers.js";
import { applyTakeWound } from "./atomicCardEffects.js";
import { applyGainAttack } from "./atomicCombatEffects.js";
import { nextRandom } from "../../utils/rng.js";
import type { ManaColor } from "@mage-knight/shared";
import { ALL_MANA_COLORS } from "@mage-knight/shared";

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

// ============================================================================
// EFFECT HANDLERS
// ============================================================================

/**
 * Roll mana dice and gain wounds for each black or red result.
 * Used by Horn of Wrath basic effect.
 */
function handleRollDieForWound(
  state: GameState,
  playerId: string,
  effect: RollDieForWoundEffect
): EffectResolutionResult {
  const { playerIndex } = getPlayerContext(state, playerId);

  let currentState = state;
  let currentRng = state.rng;
  let woundsGained = 0;
  const rollResults: ManaColor[] = [];

  for (let i = 0; i < effect.diceCount; i++) {
    const { color, rng: newRng } = rollManaDie(currentRng);
    currentRng = newRng;
    rollResults.push(color);

    if ((effect.woundColors as readonly string[]).includes(color)) {
      woundsGained++;
    }
  }

  currentState = { ...currentState, rng: currentRng };

  if (woundsGained > 0) {
    const currentPlayer = currentState.players[playerIndex];
    if (!currentPlayer) {
      throw new Error(`Player not found at index: ${playerIndex}`);
    }
    const woundResult = applyTakeWound(currentState, playerIndex, currentPlayer, woundsGained);
    currentState = woundResult.state;
  }

  const rollStr = rollResults.join(", ");
  const woundStr = woundsGained > 0
    ? `Gained ${woundsGained} wound${woundsGained > 1 ? "s" : ""}`
    : "No wounds";

  return {
    state: currentState,
    description: `Rolled: ${rollStr}. ${woundStr}`,
  };
}

/**
 * Present choices for bonus amount (0 to max).
 * Each option represents a different bonus + dice count.
 */
function handleChooseBonusWithRisk(
  state: GameState,
  _playerId: string,
  effect: ChooseBonusWithRiskEffect
): EffectResolutionResult {
  const options: ResolveBonusChoiceEffect[] = [];

  for (let bonus = 0; bonus <= effect.maxBonus; bonus++) {
    options.push({
      type: EFFECT_RESOLVE_BONUS_CHOICE,
      bonus,
      attackType: effect.attackType,
      woundColors: effect.woundColors,
    });
  }

  return {
    state,
    description: `Choose bonus Siege Attack (0 to +${effect.maxBonus}), rolling 1 die per +1`,
    requiresChoice: true,
    dynamicChoiceOptions: options,
  };
}

/**
 * Resolve the bonus choice: gain siege attack and roll dice for wound risk.
 */
function handleResolveBonusChoice(
  state: GameState,
  playerId: string,
  effect: ResolveBonusChoiceEffect
): EffectResolutionResult {
  const { playerIndex, player } = getPlayerContext(state, playerId);

  let currentState = state;
  const descriptions: string[] = [];

  // Apply bonus siege attack
  if (effect.bonus > 0) {
    const attackResult = applyGainAttack(currentState, playerIndex, player, {
      type: "gain_attack" as const,
      amount: effect.bonus,
      combatType: effect.attackType,
    });
    currentState = attackResult.state;
    descriptions.push(`+${effect.bonus} Siege Attack`);
  } else {
    descriptions.push("No bonus chosen");
  }

  // Roll dice for wound risk
  if (effect.bonus > 0) {
    let currentRng = currentState.rng;
    let woundsGained = 0;
    const rollResults: ManaColor[] = [];

    for (let i = 0; i < effect.bonus; i++) {
      const { color, rng: newRng } = rollManaDie(currentRng);
      currentRng = newRng;
      rollResults.push(color);

      if ((effect.woundColors as readonly string[]).includes(color)) {
        woundsGained++;
      }
    }

    currentState = { ...currentState, rng: currentRng };

    if (woundsGained > 0) {
      const currentPlayer = currentState.players[playerIndex];
      if (!currentPlayer) {
        throw new Error(`Player not found at index: ${playerIndex}`);
      }
      const woundResult = applyTakeWound(currentState, playerIndex, currentPlayer, woundsGained);
      currentState = woundResult.state;
    }

    const rollStr = rollResults.join(", ");
    const woundStr = woundsGained > 0
      ? `${woundsGained} wound${woundsGained > 1 ? "s" : ""}`
      : "no wounds";
    descriptions.push(`Rolled: ${rollStr} (${woundStr})`);
  }

  return {
    state: currentState,
    description: descriptions.join(". "),
  };
}

// ============================================================================
// REGISTRATION
// ============================================================================

export function registerHornOfWrathEffects(): void {
  registerEffect(EFFECT_ROLL_DIE_FOR_WOUND, (state, playerId, effect) => {
    return handleRollDieForWound(state, playerId, effect as RollDieForWoundEffect);
  });

  registerEffect(EFFECT_CHOOSE_BONUS_WITH_RISK, (state, playerId, effect) => {
    return handleChooseBonusWithRisk(state, playerId, effect as ChooseBonusWithRiskEffect);
  });

  registerEffect(EFFECT_RESOLVE_BONUS_CHOICE, (state, playerId, effect) => {
    return handleResolveBonusChoice(state, playerId, effect as ResolveBonusChoiceEffect);
  });
}
