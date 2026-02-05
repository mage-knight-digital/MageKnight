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

import { ABILITY_FORTIFIED, MANA_BLUE, MANA_GREEN, MANA_WHITE } from "@mage-knight/shared";
import type { CardEffect } from "../types/cards.js";
import {
  EFFECT_SELECT_COMBAT_ENEMY,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_GAIN_MANA,
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_CRYSTAL,
  EFFECT_CHOICE,
  EFFECT_COMPOUND,
  EFFECT_READY_UNIT,
  EFFECT_APPLY_MODIFIER,
  EFFECT_SCOUT_PEEK,
  COMBAT_TYPE_MELEE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
} from "../types/effectTypes.js";
import {
  DURATION_COMBAT,
  DURATION_TURN,
  EFFECT_ABILITY_NULLIFIER,
  EFFECT_ENEMY_SKIP_ATTACK,
  EFFECT_REMOVE_RESISTANCES,
  EFFECT_RULE_OVERRIDE,
  ELEMENT_ICE,
  RULE_EXTENDED_EXPLORE,
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

/**
 * Illusionists: White mana ability
 * Target unfortified, non-arcane-immune enemy does not attack this combat
 */
export const ILLUSIONISTS_CANCEL_ATTACK = "illusionists_cancel_attack" as const;

/**
 * Illusionists: Free ability
 * Gain a white crystal
 */
export const ILLUSIONISTS_GAIN_WHITE_CRYSTAL = "illusionists_gain_white_crystal" as const;

/**
 * Scouts: Scout peek ability (free, non-combat)
 * Reveal face-down enemy tokens within 3 spaces.
 * +1 Fame if any revealed enemy is defeated this turn.
 */
export const SCOUTS_SCOUT_PEEK = "scouts_scout_peek" as const;

/**
 * Scouts: Extended move ability (free, non-combat)
 * Move 2 + allow exploring tiles at distance 2 instead of 1 this turn.
 */
export const SCOUTS_EXTENDED_MOVE = "scouts_extended_move" as const;

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

/**
 * Illusionists' Cancel Attack ability effect.
 * Targets an unfortified, non-arcane-immune enemy and cancels all their attacks.
 * Uses EFFECT_ENEMY_SKIP_ATTACK modifier (same as Whirlwind spell).
 *
 * Key restrictions:
 * - excludeFortified: Only unfortified enemies can be targeted
 * - excludeArcaneImmune: Arcane Immunity blocks this magical effect
 * - Can combo with Demolish (remove fortification first, then target)
 * - Works against Multi-Attack enemies (cancels ALL attacks)
 */
const ILLUSIONISTS_CANCEL_ATTACK_EFFECT: CardEffect = {
  type: EFFECT_SELECT_COMBAT_ENEMY,
  excludeFortified: true,
  excludeArcaneImmune: true,
  template: {
    modifiers: [
      {
        modifier: { type: EFFECT_ENEMY_SKIP_ATTACK },
        duration: DURATION_COMBAT,
        description: "Target enemy does not attack",
      },
    ],
  },
};

/**
 * Illusionists' Gain White Crystal ability effect.
 * Grants one white crystal to the player's inventory.
 */
const ILLUSIONISTS_GAIN_WHITE_CRYSTAL_EFFECT: CardEffect = {
  type: EFFECT_GAIN_CRYSTAL,
  color: MANA_WHITE,
};

/**
 * Scouts' Scout peek ability.
 * Reveals face-down enemy tokens within 3 hexes of the player.
 * Creates a ScoutFameBonus modifier that grants +1 fame per revealed enemy
 * defeated this turn.
 */
const SCOUTS_SCOUT_PEEK_EFFECT: CardEffect = {
  type: EFFECT_SCOUT_PEEK,
  distance: 3,
  fame: 1,
};

/**
 * Scouts' extended move ability.
 * Grants Move 2 and applies a modifier allowing exploration at distance 2.
 */
const SCOUTS_EXTENDED_MOVE_EFFECT: CardEffect = {
  type: EFFECT_COMPOUND,
  effects: [
    { type: EFFECT_GAIN_MOVE, amount: 2 },
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_RULE_OVERRIDE,
        rule: RULE_EXTENDED_EXPLORE,
      },
      duration: DURATION_TURN,
      description: "May explore tiles at distance 2",
    },
  ],
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
  [ILLUSIONISTS_CANCEL_ATTACK]: ILLUSIONISTS_CANCEL_ATTACK_EFFECT,
  [ILLUSIONISTS_GAIN_WHITE_CRYSTAL]: ILLUSIONISTS_GAIN_WHITE_CRYSTAL_EFFECT,
  [SCOUTS_SCOUT_PEEK]: SCOUTS_SCOUT_PEEK_EFFECT,
  [SCOUTS_EXTENDED_MOVE]: SCOUTS_EXTENDED_MOVE_EFFECT,
};

/**
 * Get an effect by ID.
 * @param effectId - The effect ID to look up
 * @returns The CardEffect or undefined if not found
 */
export function getUnitAbilityEffect(effectId: string): CardEffect | undefined {
  return UNIT_ABILITY_EFFECTS[effectId];
}
