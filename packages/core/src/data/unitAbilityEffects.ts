/**
 * Unit Ability Effects Registry
 *
 * This module defines CardEffect-based abilities for units that need
 * complex effect resolution (compound effects, enemy targeting, etc.).
 *
 * Unit definitions in @mage-knight/shared reference these by effectId.
 * The activation command looks up the effect here and resolves it.
 *
 * @module data/unitAbilityEffects
 */

import { ABILITY_FORTIFIED } from "@mage-knight/shared";
import type { CardEffect } from "../types/cards.js";
import {
  EFFECT_SELECT_COMBAT_ENEMY,
  EFFECT_GAIN_ATTACK,
  COMBAT_TYPE_RANGED,
} from "../types/effectTypes.js";
import {
  DURATION_COMBAT,
  EFFECT_ABILITY_NULLIFIER,
  EFFECT_REMOVE_RESISTANCES,
} from "../types/modifierConstants.js";

// =============================================================================
// EFFECT IDS
// =============================================================================

/**
 * Sorcerers: White mana ability
 * Strip fortification from one enemy + Ranged Attack 3
 */
export const SORCERERS_STRIP_FORTIFICATION = "sorcerers_strip_fortification" as const;

/**
 * Sorcerers: Green mana ability
 * Strip resistances from one enemy + Ranged Attack 3
 */
export const SORCERERS_STRIP_RESISTANCES = "sorcerers_strip_resistances" as const;

// =============================================================================
// EFFECT DEFINITIONS
// =============================================================================

/**
 * Sorcerers' White mana ability effect.
 * Targets an enemy and:
 * 1. Removes fortification (blocked by Arcane Immunity)
 * 2. Grants Ranged Attack 3 (always works, bundled with targeting)
 *
 * Using bundledEffect ensures the ranged attack resolves after targeting,
 * even when auto-resolving single-enemy scenarios.
 *
 * The bundled attack must be used in the same phase or is forfeited
 * (standard combat accumulator behavior handles this).
 */
const SORCERERS_STRIP_FORTIFICATION_EFFECT: CardEffect = {
  type: EFFECT_SELECT_COMBAT_ENEMY,
  template: {
    modifiers: [
      {
        modifier: { type: EFFECT_ABILITY_NULLIFIER, ability: ABILITY_FORTIFIED },
        duration: DURATION_COMBAT,
        description: "Target enemy loses fortification",
      },
    ],
    bundledEffect: {
      type: EFFECT_GAIN_ATTACK,
      amount: 3,
      combatType: COMBAT_TYPE_RANGED,
    },
  },
};

/**
 * Sorcerers' Green mana ability effect.
 * Targets an enemy and:
 * 1. Removes all resistances (blocked by Arcane Immunity)
 * 2. Grants Ranged Attack 3 (always works, bundled with targeting)
 *
 * Using bundledEffect ensures the ranged attack resolves after targeting,
 * even when auto-resolving single-enemy scenarios.
 *
 * The bundled attack must be used in the same phase or is forfeited
 * (standard combat accumulator behavior handles this).
 */
const SORCERERS_STRIP_RESISTANCES_EFFECT: CardEffect = {
  type: EFFECT_SELECT_COMBAT_ENEMY,
  template: {
    modifiers: [
      {
        modifier: { type: EFFECT_REMOVE_RESISTANCES },
        duration: DURATION_COMBAT,
        description: "Target enemy loses all resistances",
      },
    ],
    bundledEffect: {
      type: EFFECT_GAIN_ATTACK,
      amount: 3,
      combatType: COMBAT_TYPE_RANGED,
    },
  },
};

// =============================================================================
// REGISTRY
// =============================================================================

/**
 * Registry mapping effect IDs to their CardEffect definitions.
 * Used by activateUnitCommand to resolve effect-based unit abilities.
 */
export const UNIT_ABILITY_EFFECTS: Record<string, CardEffect> = {
  [SORCERERS_STRIP_FORTIFICATION]: SORCERERS_STRIP_FORTIFICATION_EFFECT,
  [SORCERERS_STRIP_RESISTANCES]: SORCERERS_STRIP_RESISTANCES_EFFECT,
};

/**
 * Get an effect by ID.
 * @param effectId - The effect ID to look up
 * @returns The CardEffect or undefined if not found
 */
export function getUnitAbilityEffect(effectId: string): CardEffect | undefined {
  return UNIT_ABILITY_EFFECTS[effectId];
}
