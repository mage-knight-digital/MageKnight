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

import { ABILITY_FORTIFIED, MANA_BLUE, MANA_GREEN } from "@mage-knight/shared";
import type { CardEffect } from "../types/cards.js";
import {
  EFFECT_SELECT_COMBAT_ENEMY,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_GAIN_MANA,
  EFFECT_GAIN_CRYSTAL,
  EFFECT_CHOICE,
  EFFECT_COMPOUND,
  EFFECT_READY_UNIT,
  COMBAT_TYPE_MELEE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
} from "../types/effectTypes.js";
import {
  DURATION_COMBAT,
  EFFECT_ABILITY_NULLIFIER,
  EFFECT_REMOVE_RESISTANCES,
  ELEMENT_ICE,
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
 * Ice Mages: Basic ability (free)
 * Ice Attack 4 OR Ice Block 4
 */
export const ICE_MAGES_ATTACK_OR_BLOCK = "ice_mages_attack_or_block" as const;

/**
 * Ice Mages: Blue mana ability
 * Siege Ice Attack 4
 */
export const ICE_MAGES_SIEGE_ATTACK = "ice_mages_siege_attack" as const;

/**
 * Ice Mages: Free ability
 * Gain blue mana token + blue crystal
 */
export const ICE_MAGES_GAIN_MANA_CRYSTAL = "ice_mages_gain_mana_crystal" as const;

/**
 * Sorcerers: Green mana ability
 * Strip resistances from one enemy + Ranged Attack 3
 */
export const SORCERERS_STRIP_RESISTANCES = "sorcerers_strip_resistances" as const;

/**
 * Herbalist: Free ability
 * Ready a level 1 or 2 unit
 */
export const HERBALIST_READY_UNIT = "herbalist_ready_unit" as const;

/**
 * Herbalist: Free ability
 * Gain a green mana token
 */
export const HERBALIST_GAIN_MANA = "herbalist_gain_mana" as const;

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

/**
 * Ice Mages' basic ability: Ice Attack 4 OR Ice Block 4.
 * Player chooses between gaining 4 Ice Attack (melee) or 4 Ice Block.
 */
const ICE_MAGES_ATTACK_OR_BLOCK_EFFECT: CardEffect = {
  type: EFFECT_CHOICE,
  options: [
    {
      type: EFFECT_GAIN_ATTACK,
      amount: 4,
      combatType: COMBAT_TYPE_MELEE,
      element: ELEMENT_ICE,
    },
    {
      type: EFFECT_GAIN_BLOCK,
      amount: 4,
      element: ELEMENT_ICE,
    },
  ],
};

/**
 * Ice Mages' Blue mana ability: Siege Ice Attack 4.
 * Requires blue mana. Grants a siege attack with ice element.
 */
const ICE_MAGES_SIEGE_ATTACK_EFFECT: CardEffect = {
  type: EFFECT_GAIN_ATTACK,
  amount: 4,
  combatType: COMBAT_TYPE_SIEGE,
  element: ELEMENT_ICE,
};

/**
 * Ice Mages' resource generation ability.
 * Grants 1 blue mana token + 1 blue crystal.
 */
const ICE_MAGES_GAIN_MANA_CRYSTAL_EFFECT: CardEffect = {
  type: EFFECT_COMPOUND,
  effects: [
    { type: EFFECT_GAIN_MANA, color: MANA_BLUE },
    { type: EFFECT_GAIN_CRYSTAL, color: MANA_BLUE },
  ],
};

/**
 * Herbalist's ready unit ability.
 * Ready a spent unit of level 1 or 2.
 */
const HERBALIST_READY_UNIT_EFFECT: CardEffect = {
  type: EFFECT_READY_UNIT,
  maxLevel: 2,
};

/**
 * Herbalist's mana generation ability.
 * Grants 1 green mana token.
 */
const HERBALIST_GAIN_MANA_EFFECT: CardEffect = {
  type: EFFECT_GAIN_MANA,
  color: MANA_GREEN,
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
  [ICE_MAGES_ATTACK_OR_BLOCK]: ICE_MAGES_ATTACK_OR_BLOCK_EFFECT,
  [ICE_MAGES_SIEGE_ATTACK]: ICE_MAGES_SIEGE_ATTACK_EFFECT,
  [ICE_MAGES_GAIN_MANA_CRYSTAL]: ICE_MAGES_GAIN_MANA_CRYSTAL_EFFECT,
  [HERBALIST_READY_UNIT]: HERBALIST_READY_UNIT_EFFECT,
  [HERBALIST_GAIN_MANA]: HERBALIST_GAIN_MANA_EFFECT,
};

/**
 * Get an effect by ID.
 * @param effectId - The effect ID to look up
 * @returns The CardEffect or undefined if not found
 */
export function getUnitAbilityEffect(effectId: string): CardEffect | undefined {
  return UNIT_ABILITY_EFFECTS[effectId];
}
