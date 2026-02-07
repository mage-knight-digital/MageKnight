/**
 * Mana Bolt / Mana Thunderbolt Effect Handler
 *
 * Generates dynamic choice options where the player pays a basic mana token
 * and the color determines the attack:
 * - Blue → Melee Ice Attack
 * - Red → Melee Cold Fire Attack
 * - White → Ranged Ice Attack
 * - Green → Siege Ice Attack
 *
 * The handler checks the player's available mana tokens at resolution time
 * and generates compound effects (pay mana + gain attack) for each viable color.
 *
 * @module effects/manaBoltEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { ManaBoltEffect, CardEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import {
  EFFECT_MANA_BOLT,
  EFFECT_COMPOUND,
  EFFECT_PAY_MANA,
  EFFECT_GAIN_ATTACK,
  COMBAT_TYPE_MELEE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
} from "../../types/effectTypes.js";
import {
  MANA_GREEN,
  MANA_WHITE,
  MANA_BLUE,
  MANA_RED,
  MANA_GOLD,
  ELEMENT_ICE,
  ELEMENT_COLD_FIRE,
} from "@mage-knight/shared";
import type { ManaColor } from "@mage-knight/shared";
import { countManaTokens } from "./manaPaymentEffects.js";
import { canUseGoldAsWild } from "../rules/mana.js";

/**
 * Handle the EFFECT_MANA_BOLT entry point.
 *
 * Generates dynamic choices based on available mana tokens:
 * - Blue mana → Melee Ice Attack {value}
 * - Red mana → Melee Cold Fire Attack {value}
 * - White mana → Ranged Ice Attack {value}
 * - Green mana → Siege Ice Attack {value}
 *
 * Gold mana tokens are wild and can substitute for any basic color.
 * Only available during combat.
 */
function handleManaBolt(
  state: GameState,
  playerId: string,
  effect: ManaBoltEffect
): EffectResolutionResult {
  const { player } = getPlayerContext(state, playerId);
  const base = effect.baseValue;
  const goldIsWild = canUseGoldAsWild(state);

  // Per-color attack values: Blue = base, Red = base-1, White = base-2, Green = base-3
  const blueValue = base;
  const redValue = base - 1;
  const whiteValue = base - 2;
  const greenValue = base - 3;

  // Check which basic colors the player has tokens for
  const hasGreen = countManaTokens(player, MANA_GREEN) >= 1;
  const hasWhite = countManaTokens(player, MANA_WHITE) >= 1;
  const hasBlue = countManaTokens(player, MANA_BLUE) >= 1;
  const hasRed = countManaTokens(player, MANA_RED) >= 1;
  const hasGold = goldIsWild && countManaTokens(player, MANA_GOLD) >= 1;

  const options: CardEffect[] = [];

  // Helper to create a compound option: pay mana + gain attack
  function addOption(payColor: ManaColor, gainEffect: CardEffect) {
    options.push({
      type: EFFECT_COMPOUND,
      effects: [
        { type: EFFECT_PAY_MANA, colors: [payColor], amount: 1 },
        gainEffect,
      ],
    });
  }

  // Blue → Melee Ice Attack (highest value)
  if (hasBlue) {
    addOption(MANA_BLUE, {
      type: EFFECT_GAIN_ATTACK,
      amount: blueValue,
      combatType: COMBAT_TYPE_MELEE,
      element: ELEMENT_ICE,
    });
  }

  // Red → Melee Cold Fire Attack
  if (hasRed) {
    addOption(MANA_RED, {
      type: EFFECT_GAIN_ATTACK,
      amount: redValue,
      combatType: COMBAT_TYPE_MELEE,
      element: ELEMENT_COLD_FIRE,
    });
  }

  // White → Ranged Ice Attack
  if (hasWhite) {
    addOption(MANA_WHITE, {
      type: EFFECT_GAIN_ATTACK,
      amount: whiteValue,
      combatType: COMBAT_TYPE_RANGED,
      element: ELEMENT_ICE,
    });
  }

  // Green → Siege Ice Attack (lowest value)
  if (hasGreen) {
    addOption(MANA_GREEN, {
      type: EFFECT_GAIN_ATTACK,
      amount: greenValue,
      combatType: COMBAT_TYPE_SIEGE,
      element: ELEMENT_ICE,
    });
  }

  // Gold is wild — can substitute for any basic color
  if (hasGold) {
    if (!hasBlue) {
      addOption(MANA_GOLD, {
        type: EFFECT_GAIN_ATTACK,
        amount: blueValue,
        combatType: COMBAT_TYPE_MELEE,
        element: ELEMENT_ICE,
      });
    }
    if (!hasRed) {
      addOption(MANA_GOLD, {
        type: EFFECT_GAIN_ATTACK,
        amount: redValue,
        combatType: COMBAT_TYPE_MELEE,
        element: ELEMENT_COLD_FIRE,
      });
    }
    if (!hasWhite) {
      addOption(MANA_GOLD, {
        type: EFFECT_GAIN_ATTACK,
        amount: whiteValue,
        combatType: COMBAT_TYPE_RANGED,
        element: ELEMENT_ICE,
      });
    }
    if (!hasGreen) {
      addOption(MANA_GOLD, {
        type: EFFECT_GAIN_ATTACK,
        amount: greenValue,
        combatType: COMBAT_TYPE_SIEGE,
        element: ELEMENT_ICE,
      });
    }
  }

  if (options.length === 0) {
    return {
      state,
      description: "No mana available to pay for Mana Bolt",
    };
  }

  return {
    state,
    description: "Choose mana color to pay for Mana Bolt",
    requiresChoice: true,
    dynamicChoiceOptions: options,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register Mana Bolt effect handlers with the effect registry.
 */
export function registerManaBoltEffects(): void {
  registerEffect(EFFECT_MANA_BOLT, (state, playerId, effect) => {
    return handleManaBolt(state, playerId, effect as ManaBoltEffect);
  });
}
