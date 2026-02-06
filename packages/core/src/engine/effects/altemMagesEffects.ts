/**
 * Altem Mages Cold Fire Attack/Block Effect Handler
 *
 * Generates dynamic choice options for Cold Fire Attack OR Block
 * with optional mana scaling: +blue = +2, +red = +2, +both = +4.
 *
 * The handler checks the player's available mana tokens at resolution
 * time and generates all valid options.
 *
 * @module effects/altemMagesEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { AltemMagesColdFireEffect, CardEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import {
  EFFECT_ALTEM_MAGES_COLD_FIRE,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_COMPOUND,
  EFFECT_PAY_MANA,
  COMBAT_TYPE_MELEE,
} from "../../types/effectTypes.js";
import { ELEMENT_COLD_FIRE, MANA_BLUE, MANA_RED } from "@mage-knight/shared";
import { countManaTokens } from "./manaPaymentEffects.js";

/**
 * Handle the EFFECT_ALTEM_MAGES_COLD_FIRE entry point.
 *
 * Generates dynamic choices based on available mana:
 * - Base: Cold Fire Attack {base} OR Cold Fire Block {base}
 * - +blue: Cold Fire Attack/Block {base + boost} (pays 1 blue mana)
 * - +red: Cold Fire Attack/Block {base + boost} (pays 1 red mana)
 * - +both: Cold Fire Attack/Block {base + 2*boost} (pays 1 blue + 1 red)
 */
function handleAltemMagesColdFire(
  state: GameState,
  playerId: string,
  effect: AltemMagesColdFireEffect
): EffectResolutionResult {
  const { player } = getPlayerContext(state, playerId);

  const base = effect.baseValue;
  const boost = effect.boostPerMana;
  const hasBlue = countManaTokens(player, MANA_BLUE) >= 1;
  const hasRed = countManaTokens(player, MANA_RED) >= 1;
  // For "both", need at least 1 blue AND 1 red
  const hasBoth = hasBlue && hasRed;

  const options: CardEffect[] = [];

  // Base options (always available)
  options.push({
    type: EFFECT_GAIN_ATTACK,
    amount: base,
    combatType: COMBAT_TYPE_MELEE,
    element: ELEMENT_COLD_FIRE,
  });
  options.push({
    type: EFFECT_GAIN_BLOCK,
    amount: base,
    element: ELEMENT_COLD_FIRE,
  });

  // +blue options
  if (hasBlue) {
    options.push({
      type: EFFECT_COMPOUND,
      effects: [
        { type: EFFECT_PAY_MANA, colors: [MANA_BLUE], amount: 1 },
        {
          type: EFFECT_GAIN_ATTACK,
          amount: base + boost,
          combatType: COMBAT_TYPE_MELEE,
          element: ELEMENT_COLD_FIRE,
        },
      ],
    });
    options.push({
      type: EFFECT_COMPOUND,
      effects: [
        { type: EFFECT_PAY_MANA, colors: [MANA_BLUE], amount: 1 },
        {
          type: EFFECT_GAIN_BLOCK,
          amount: base + boost,
          element: ELEMENT_COLD_FIRE,
        },
      ],
    });
  }

  // +red options
  if (hasRed) {
    options.push({
      type: EFFECT_COMPOUND,
      effects: [
        { type: EFFECT_PAY_MANA, colors: [MANA_RED], amount: 1 },
        {
          type: EFFECT_GAIN_ATTACK,
          amount: base + boost,
          combatType: COMBAT_TYPE_MELEE,
          element: ELEMENT_COLD_FIRE,
        },
      ],
    });
    options.push({
      type: EFFECT_COMPOUND,
      effects: [
        { type: EFFECT_PAY_MANA, colors: [MANA_RED], amount: 1 },
        {
          type: EFFECT_GAIN_BLOCK,
          amount: base + boost,
          element: ELEMENT_COLD_FIRE,
        },
      ],
    });
  }

  // +both options (blue AND red)
  if (hasBoth) {
    options.push({
      type: EFFECT_COMPOUND,
      effects: [
        { type: EFFECT_PAY_MANA, colors: [MANA_BLUE], amount: 1 },
        { type: EFFECT_PAY_MANA, colors: [MANA_RED], amount: 1 },
        {
          type: EFFECT_GAIN_ATTACK,
          amount: base + boost * 2,
          combatType: COMBAT_TYPE_MELEE,
          element: ELEMENT_COLD_FIRE,
        },
      ],
    });
    options.push({
      type: EFFECT_COMPOUND,
      effects: [
        { type: EFFECT_PAY_MANA, colors: [MANA_BLUE], amount: 1 },
        { type: EFFECT_PAY_MANA, colors: [MANA_RED], amount: 1 },
        {
          type: EFFECT_GAIN_BLOCK,
          amount: base + boost * 2,
          element: ELEMENT_COLD_FIRE,
        },
      ],
    });
  }

  return {
    state,
    description: "Choose Cold Fire Attack or Block",
    requiresChoice: true,
    dynamicChoiceOptions: options,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register Altem Mages effect handlers with the effect registry.
 */
export function registerAltemMagesEffects(): void {
  registerEffect(EFFECT_ALTEM_MAGES_COLD_FIRE, (state, playerId, effect) => {
    return handleAltemMagesColdFire(
      state,
      playerId,
      effect as AltemMagesColdFireEffect
    );
  });
}
