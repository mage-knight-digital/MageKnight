/**
 * Pure Magic Effect Handler
 *
 * Generates dynamic choice options where the player pays a basic mana token
 * and the color determines the effect:
 * - Green → Move
 * - White → Influence
 * - Blue → Block (combat only)
 * - Red → Attack (combat only)
 *
 * The handler checks the player's available mana tokens at resolution time
 * and generates compound effects (pay mana + gain effect) for each viable color.
 *
 * @module effects/pureMagicEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { PureMagicEffect, CardEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import {
  EFFECT_PURE_MAGIC,
  EFFECT_COMPOUND,
  EFFECT_PAY_MANA,
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_GAIN_BLOCK,
  EFFECT_GAIN_ATTACK,
  COMBAT_TYPE_MELEE,
} from "../../types/effectTypes.js";
import { MANA_GREEN, MANA_WHITE, MANA_BLUE, MANA_RED, MANA_GOLD } from "@mage-knight/shared";
import type { ManaColor } from "@mage-knight/shared";
import { countManaTokens } from "./manaPaymentEffects.js";
import { canUseGoldAsWild } from "../rules/mana.js";

/**
 * Handle the EFFECT_PURE_MAGIC entry point.
 *
 * Generates dynamic choices based on available mana tokens and combat state:
 * - Green mana → Move {value} (always available)
 * - White mana → Influence {value} (always available)
 * - Blue mana → Block {value} (combat only)
 * - Red mana → Attack {value} (combat only)
 *
 * Gold mana tokens are wild and can substitute for any basic color,
 * so each gold token adds options for all eligible basic colors.
 */
function handlePureMagic(
  state: GameState,
  playerId: string,
  effect: PureMagicEffect
): EffectResolutionResult {
  const { player } = getPlayerContext(state, playerId);
  const value = effect.value;
  const inCombat = state.combat !== null;
  const goldIsWild = canUseGoldAsWild(state);

  // Check which basic colors the player has tokens for
  const hasGreen = countManaTokens(player, MANA_GREEN) >= 1;
  const hasWhite = countManaTokens(player, MANA_WHITE) >= 1;
  const hasBlue = countManaTokens(player, MANA_BLUE) >= 1;
  const hasRed = countManaTokens(player, MANA_RED) >= 1;
  const hasGold = goldIsWild && countManaTokens(player, MANA_GOLD) >= 1;

  const options: CardEffect[] = [];

  // Helper to create a compound option: pay mana + gain effect
  function addOption(payColor: ManaColor, gainEffect: CardEffect) {
    options.push({
      type: EFFECT_COMPOUND,
      effects: [
        { type: EFFECT_PAY_MANA, colors: [payColor], amount: 1 },
        gainEffect,
      ],
    });
  }

  // Green → Move (always available outside/inside combat)
  if (hasGreen) {
    addOption(MANA_GREEN, { type: EFFECT_GAIN_MOVE, amount: value });
  }

  // White → Influence (always available outside/inside combat)
  if (hasWhite) {
    addOption(MANA_WHITE, { type: EFFECT_GAIN_INFLUENCE, amount: value });
  }

  // Blue → Block (combat only)
  if (hasBlue && inCombat) {
    addOption(MANA_BLUE, { type: EFFECT_GAIN_BLOCK, amount: value });
  }

  // Red → Attack (combat only)
  if (hasRed && inCombat) {
    addOption(MANA_RED, {
      type: EFFECT_GAIN_ATTACK,
      amount: value,
      combatType: COMBAT_TYPE_MELEE,
    });
  }

  // Gold is wild — can substitute for any basic color
  if (hasGold) {
    // Green → Move
    if (!hasGreen) {
      addOption(MANA_GOLD, { type: EFFECT_GAIN_MOVE, amount: value });
    }
    // White → Influence
    if (!hasWhite) {
      addOption(MANA_GOLD, { type: EFFECT_GAIN_INFLUENCE, amount: value });
    }
    // Blue → Block (combat only)
    if (!hasBlue && inCombat) {
      addOption(MANA_GOLD, { type: EFFECT_GAIN_BLOCK, amount: value });
    }
    // Red → Attack (combat only)
    if (!hasRed && inCombat) {
      addOption(MANA_GOLD, {
        type: EFFECT_GAIN_ATTACK,
        amount: value,
        combatType: COMBAT_TYPE_MELEE,
      });
    }
  }

  if (options.length === 0) {
    return {
      state,
      description: "No mana available to pay for Pure Magic",
    };
  }

  return {
    state,
    description: "Choose mana color to pay for Pure Magic",
    requiresChoice: true,
    dynamicChoiceOptions: options,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register Pure Magic effect handlers with the effect registry.
 */
export function registerPureMagicEffects(): void {
  registerEffect(EFFECT_PURE_MAGIC, (state, playerId, effect) => {
    return handlePureMagic(state, playerId, effect as PureMagicEffect);
  });
}
