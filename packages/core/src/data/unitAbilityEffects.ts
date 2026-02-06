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

import {
  ABILITY_FORTIFIED,
  AMOTEP_FREEZERS_FREEZE,
  MANA_BLUE,
  MANA_GREEN,
  MANA_RED,
  MANA_WHITE,
  RESIST_FIRE,
  RESIST_ICE,
  RESIST_PHYSICAL,
  SHOCKTROOPS_COORDINATED_FIRE,
  SHOCKTROOPS_WEAKEN_ENEMY,
  SHOCKTROOPS_TAUNT,
} from "@mage-knight/shared";
import type { CardEffect } from "../types/cards.js";
import {
  EFFECT_SELECT_COMBAT_ENEMY,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_GAIN_MANA,
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_CRYSTAL,
  EFFECT_CHANGE_REPUTATION,
  EFFECT_CHOICE,
  EFFECT_COMPOUND,
  EFFECT_READY_UNIT,
  EFFECT_APPLY_MODIFIER,
  EFFECT_SCOUT_PEEK,
  EFFECT_WOUND_ACTIVATING_UNIT,
  EFFECT_ALTEM_MAGES_COLD_FIRE,
  COMBAT_TYPE_MELEE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
} from "../types/effectTypes.js";
import {
  DURATION_COMBAT,
  DURATION_TURN,
  EFFECT_ABILITY_NULLIFIER,
  EFFECT_ENEMY_SKIP_ATTACK,
  EFFECT_ENEMY_STAT,
  EFFECT_GRANT_RESISTANCES,
  EFFECT_REMOVE_RESISTANCES,
  EFFECT_RULE_OVERRIDE,
  EFFECT_UNIT_ATTACK_BONUS,
  EFFECT_TRANSFORM_ATTACKS_COLD_FIRE,
  EFFECT_ADD_SIEGE_TO_ATTACKS,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ENEMY_STAT_ARMOR,
  ENEMY_STAT_ATTACK,
  RULE_EXTENDED_EXPLORE,
  SCOPE_ALL_UNITS,
  SCOPE_SELF,
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
 * Fire Mages: Red mana ability
 * Fire Attack 6 OR Fire Block 6
 */
export const FIRE_MAGES_ATTACK_OR_BLOCK = "fire_mages_attack_or_block" as const;

/**
 * Fire Mages: Free ability
 * Gain red mana token + red crystal
 */
export const FIRE_MAGES_GAIN_MANA_CRYSTAL = "fire_mages_gain_mana_crystal" as const;

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

/**
 * Utem Swordsmen: Basic ability (free)
 * Attack 3 OR Block 3
 */
export const UTEM_SWORDSMEN_ATTACK_OR_BLOCK = "utem_swordsmen_attack_or_block" as const;

/**
 * Utem Swordsmen: Powered ability (free)
 * Attack 6 OR Block 6 — this unit becomes wounded
 */
export const UTEM_SWORDSMEN_ATTACK_OR_BLOCK_WOUND = "utem_swordsmen_attack_or_block_wound" as const;

/**
 * Utem Crossbowmen: Basic ability (free)
 * Attack 3 OR Block 3
 */
export const UTEM_CROSSBOWMEN_ATTACK_OR_BLOCK = "utem_crossbowmen_attack_or_block" as const;

/**
 * Ice Golems: Basic ability (free)
 * Attack 3 OR Block 3 (Ice)
 */
export const ICE_GOLEMS_ATTACK_OR_BLOCK = "ice_golems_attack_or_block" as const;

/**
 * Thugs: Free ability (combat only)
 * Attack 3 (Physical) + Reputation -1 (immediate)
 */
export const THUGS_ATTACK = "thugs_attack" as const;

/**
 * Thugs: Free ability (non-combat)
 * Influence 4 + Reputation -1 (immediate)
 */
export const THUGS_INFLUENCE = "thugs_influence" as const;

/**
 * Altem Guardians: Green mana ability
 * All units you control gain all resistances (Physical, Fire, Ice) this turn.
 */
export const ALTEM_GUARDIANS_GRANT_RESISTANCES =
  "altem_guardians_grant_resistances" as const;

/**
 * Altem Mages: Ability 1 (free, non-combat)
 * Gain 2 mana tokens of any colors (player chooses each independently).
 */
export const ALTEM_MAGES_GAIN_TWO_MANA =
  "altem_mages_gain_two_mana" as const;

/**
 * Altem Mages: Ability 2 (free, combat)
 * Cold Fire Attack 5 OR Cold Fire Block 5.
 * Scaling: +blue = 7, +red = 7, +both = 9.
 */
export const ALTEM_MAGES_COLD_FIRE_ATTACK_OR_BLOCK =
  "altem_mages_cold_fire_attack_or_block" as const;

/**
 * Altem Mages: Ability 3 (black mana, combat)
 * Choose: All attacks become Cold Fire this combat,
 * OR all attacks gain Siege in addition to existing types.
 */
export const ALTEM_MAGES_ATTACK_MODIFIER =
  "altem_mages_attack_modifier" as const;

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
 * Fire Mages' Red mana ability: Fire Attack 6 OR Fire Block 6.
 * Player chooses between gaining 6 Fire Attack (melee) or 6 Fire Block.
 */
const FIRE_MAGES_ATTACK_OR_BLOCK_EFFECT: CardEffect = {
  type: EFFECT_CHOICE,
  options: [
    {
      type: EFFECT_GAIN_ATTACK,
      amount: 6,
      combatType: COMBAT_TYPE_MELEE,
      element: ELEMENT_FIRE,
    },
    {
      type: EFFECT_GAIN_BLOCK,
      amount: 6,
      element: ELEMENT_FIRE,
    },
  ],
};

/**
 * Fire Mages' resource generation ability.
 * Grants 1 red mana token + 1 red crystal.
 */
const FIRE_MAGES_GAIN_MANA_CRYSTAL_EFFECT: CardEffect = {
  type: EFFECT_COMPOUND,
  effects: [
    { type: EFFECT_GAIN_MANA, color: MANA_RED },
    { type: EFFECT_GAIN_CRYSTAL, color: MANA_RED },
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
 * Amotep Freezers' Freeze ability (blue mana).
 * Target enemy does not attack this combat and gets Armor -3 (min 1).
 * No effect on Ice Resistant enemies (excludeResistance: RESIST_ICE).
 */
const AMOTEP_FREEZERS_FREEZE_EFFECT: CardEffect = {
  type: EFFECT_SELECT_COMBAT_ENEMY,
  excludeResistance: RESIST_ICE,
  template: {
    modifiers: [
      {
        modifier: { type: EFFECT_ENEMY_SKIP_ATTACK },
        duration: DURATION_COMBAT,
        description: "Target enemy does not attack",
      },
      {
        modifier: {
          type: EFFECT_ENEMY_STAT,
          stat: ENEMY_STAT_ARMOR,
          amount: -3,
          minimum: 1,
        },
        duration: DURATION_COMBAT,
        description: "Target enemy gets Armor -3",
      },
    ],
  },
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

/**
 * Utem Swordsmen's basic ability: Attack 3 OR Block 3.
 * Player chooses between gaining 3 Attack (melee, physical) or 3 Block (physical).
 */
const UTEM_SWORDSMEN_ATTACK_OR_BLOCK_EFFECT: CardEffect = {
  type: EFFECT_CHOICE,
  options: [
    {
      type: EFFECT_GAIN_ATTACK,
      amount: 3,
      combatType: COMBAT_TYPE_MELEE,
    },
    {
      type: EFFECT_GAIN_BLOCK,
      amount: 3,
    },
  ],
};

/**
 * Utem Swordsmen's powered ability: Attack 6 OR Block 6 — this unit becomes wounded.
 * Player chooses between gaining 6 Attack (melee, physical) or 6 Block (physical).
 * Both options wound the activating unit as a cost (self-inflicted, not combat damage).
 *
 * The __ACTIVATING_UNIT__ placeholder is replaced with the actual unit instance ID
 * at activation time by the activate unit command.
 */
const UTEM_SWORDSMEN_ATTACK_OR_BLOCK_WOUND_EFFECT: CardEffect = {
  type: EFFECT_CHOICE,
  options: [
    {
      type: EFFECT_COMPOUND,
      effects: [
        {
          type: EFFECT_GAIN_ATTACK,
          amount: 6,
          combatType: COMBAT_TYPE_MELEE,
        },
        {
          type: EFFECT_WOUND_ACTIVATING_UNIT,
          unitInstanceId: "__ACTIVATING_UNIT__",
        },
      ],
    },
    {
      type: EFFECT_COMPOUND,
      effects: [
        {
          type: EFFECT_GAIN_BLOCK,
          amount: 6,
        },
        {
          type: EFFECT_WOUND_ACTIVATING_UNIT,
          unitInstanceId: "__ACTIVATING_UNIT__",
        },
      ],
    },
  ],
};

/**
 * Utem Crossbowmen's basic ability: Attack 3 OR Block 3.
 * Player chooses between gaining 3 Attack (melee, physical) or 3 Block (physical).
 */
const UTEM_CROSSBOWMEN_ATTACK_OR_BLOCK_EFFECT: CardEffect = {
  type: EFFECT_CHOICE,
  options: [
    {
      type: EFFECT_GAIN_ATTACK,
      amount: 3,
      combatType: COMBAT_TYPE_MELEE,
    },
    {
      type: EFFECT_GAIN_BLOCK,
      amount: 3,
    },
  ],
};

/**
 * Ice Golems' basic ability: Attack 3 OR Block 3 (Ice).
 * Player chooses between gaining 3 Ice Attack (melee) or 3 Ice Block.
 */
const ICE_GOLEMS_ATTACK_OR_BLOCK_EFFECT: CardEffect = {
  type: EFFECT_CHOICE,
  options: [
    {
      type: EFFECT_GAIN_ATTACK,
      amount: 3,
      combatType: COMBAT_TYPE_MELEE,
      element: ELEMENT_ICE,
    },
    {
      type: EFFECT_GAIN_BLOCK,
      amount: 3,
      element: ELEMENT_ICE,
    },
  ],
};

/**
 * Thugs' Attack ability effect.
 * Compound: Attack 3 Physical (melee) + Reputation -1 (immediate).
 * Per FAQ: reputation change is immediate, not at end of turn.
 */
const THUGS_ATTACK_EFFECT: CardEffect = {
  type: EFFECT_COMPOUND,
  effects: [
    {
      type: EFFECT_GAIN_ATTACK,
      amount: 3,
      combatType: COMBAT_TYPE_MELEE,
    },
    {
      type: EFFECT_CHANGE_REPUTATION,
      amount: -1,
    },
  ],
};

/**
 * Thugs' Influence ability effect.
 * Compound: Influence 4 + Reputation -1 (immediate).
 * Per FAQ: reputation change is immediate, not at end of turn.
 */
const THUGS_INFLUENCE_EFFECT: CardEffect = {
  type: EFFECT_COMPOUND,
  effects: [
    {
      type: EFFECT_GAIN_INFLUENCE,
      amount: 4,
    },
    {
      type: EFFECT_CHANGE_REPUTATION,
      amount: -1,
    },
  ],
};

// =============================================================================
// SHOCKTROOPS EFFECTS
// =============================================================================

/**
 * Shocktroops' Ability 1: Coordinated Fire
 * Ranged Attack 1 + all units get +1 to all their attacks this combat.
 *
 * The unit buff uses SCOPE_ALL_UNITS. Since the activating Shocktroops
 * is already spent after activation, it naturally can't benefit from its
 * own buff. Multiple Shocktroops stack correctly: second Shocktroops
 * gets +1 from the first, all other units get +2.
 */
const SHOCKTROOPS_COORDINATED_FIRE_EFFECT: CardEffect = {
  type: EFFECT_COMPOUND,
  effects: [
    {
      type: EFFECT_GAIN_ATTACK,
      amount: 1,
      combatType: COMBAT_TYPE_RANGED,
    },
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_UNIT_ATTACK_BONUS,
        amount: 1,
      },
      duration: DURATION_COMBAT,
      scope: { type: SCOPE_ALL_UNITS },
      description: "All units get +1 to all attacks this combat",
    },
  ],
};

/**
 * Shocktroops' Ability 2: Weaken Enemy
 * Target one enemy: reduce its armor by 1 (minimum 1) and one attack by 1 (minimum 0).
 *
 * This ability targets a single enemy and applies two stat modifiers.
 * Blocked by Arcane Immunity (modifiers won't apply to Arcane Immune enemies).
 * Works in any combat phase (usable in ranged phase despite being defensive).
 */
const SHOCKTROOPS_WEAKEN_ENEMY_EFFECT: CardEffect = {
  type: EFFECT_SELECT_COMBAT_ENEMY,
  template: {
    modifiers: [
      {
        modifier: {
          type: EFFECT_ENEMY_STAT,
          stat: ENEMY_STAT_ARMOR,
          amount: -1,
          minimum: 1,
        },
        duration: DURATION_COMBAT,
        description: "Reduce enemy armor by 1",
      },
      {
        modifier: {
          type: EFFECT_ENEMY_STAT,
          stat: ENEMY_STAT_ATTACK,
          amount: -1,
          minimum: 0,
        },
        duration: DURATION_COMBAT,
        description: "Reduce enemy attack by 1",
      },
    ],
  },
};

/**
 * Shocktroops' Ability 3: Taunt + Reduce Attack
 * Target one enemy: reduce one attack by 3 (minimum 0).
 * Any damage from that enemy must be assigned to this unit first,
 * even if the enemy has Assassination.
 *
 * The damage redirect is set via setDamageRedirectFromUnit on the template.
 * The placeholder "__ACTIVATING_UNIT__" is replaced by the activation command
 * with the actual unit instance ID at resolution time.
 *
 * The attack reduction IS blocked by Arcane Immunity, but the damage redirect
 * is NOT (it's a defensive ability on the player's side).
 *
 * If the Shocktroops unit is wounded before damage assignment, the
 * redirect is inactive (unit can't absorb damage).
 */
const SHOCKTROOPS_TAUNT_EFFECT: CardEffect = {
  type: EFFECT_SELECT_COMBAT_ENEMY,
  template: {
    modifiers: [
      {
        modifier: {
          type: EFFECT_ENEMY_STAT,
          stat: ENEMY_STAT_ATTACK,
          amount: -3,
          minimum: 0,
        },
        duration: DURATION_COMBAT,
        description: "Reduce enemy attack by 3",
      },
    ],
    setDamageRedirectFromUnit: "__ACTIVATING_UNIT__",
  },
};

/**
 * Altem Guardians: Green mana ability.
 * All units you control gain Physical, Fire, and Ice resistance this turn.
 */
const ALTEM_GUARDIANS_GRANT_RESISTANCES_EFFECT: CardEffect = {
  type: EFFECT_APPLY_MODIFIER,
  modifier: {
    type: EFFECT_GRANT_RESISTANCES,
    resistances: [RESIST_PHYSICAL, RESIST_FIRE, RESIST_ICE],
  },
  duration: DURATION_TURN,
  scope: { type: SCOPE_ALL_UNITS },
  description: "All units gain all resistances this turn",
};

// =============================================================================
// ALTEM MAGES EFFECTS
// =============================================================================

/**
 * Altem Mages' Ability 1: Gain 2 mana tokens of any colors.
 * Two sequential choices, each offering all four basic mana colors.
 * Uses compound + choice pattern for independent selections.
 */
const ALTEM_MAGES_GAIN_TWO_MANA_EFFECT: CardEffect = {
  type: EFFECT_COMPOUND,
  effects: [
    {
      type: EFFECT_CHOICE,
      options: [
        { type: EFFECT_GAIN_MANA, color: MANA_RED },
        { type: EFFECT_GAIN_MANA, color: MANA_BLUE },
        { type: EFFECT_GAIN_MANA, color: MANA_GREEN },
        { type: EFFECT_GAIN_MANA, color: MANA_WHITE },
      ],
    },
    {
      type: EFFECT_CHOICE,
      options: [
        { type: EFFECT_GAIN_MANA, color: MANA_RED },
        { type: EFFECT_GAIN_MANA, color: MANA_BLUE },
        { type: EFFECT_GAIN_MANA, color: MANA_GREEN },
        { type: EFFECT_GAIN_MANA, color: MANA_WHITE },
      ],
    },
  ],
};

/**
 * Altem Mages' Ability 2: Cold Fire Attack OR Block 5.
 * Base value 5 with optional mana scaling:
 * +blue OR +red = 7, +both = 9.
 *
 * Uses the EFFECT_ALTEM_MAGES_COLD_FIRE custom effect type
 * which dynamically generates choices based on available mana.
 */
const ALTEM_MAGES_COLD_FIRE_ATTACK_OR_BLOCK_EFFECT: CardEffect = {
  type: EFFECT_ALTEM_MAGES_COLD_FIRE,
  baseValue: 5,
  boostPerMana: 2,
};

/**
 * Altem Mages' Ability 3: Attack modifier (costs black mana).
 * Choose one:
 * 1. All attacks become Cold Fire this combat
 * 2. All attacks gain Siege in addition to existing types
 *
 * Uses SCOPE_SELF since it only affects the activating player's attacks.
 * DURATION_COMBAT ensures it expires when combat ends.
 */
const ALTEM_MAGES_ATTACK_MODIFIER_EFFECT: CardEffect = {
  type: EFFECT_CHOICE,
  options: [
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: { type: EFFECT_TRANSFORM_ATTACKS_COLD_FIRE },
      duration: DURATION_COMBAT,
      scope: { type: SCOPE_SELF },
      description: "All attacks become Cold Fire this combat",
    },
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: { type: EFFECT_ADD_SIEGE_TO_ATTACKS },
      duration: DURATION_COMBAT,
      scope: { type: SCOPE_SELF },
      description: "All attacks gain Siege this combat",
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
  [UTEM_SWORDSMEN_ATTACK_OR_BLOCK]: UTEM_SWORDSMEN_ATTACK_OR_BLOCK_EFFECT,
  [UTEM_SWORDSMEN_ATTACK_OR_BLOCK_WOUND]: UTEM_SWORDSMEN_ATTACK_OR_BLOCK_WOUND_EFFECT,
  [SORCERERS_STRIP_FORTIFICATION]: SORCERERS_STRIP_FORTIFICATION_EFFECT,
  [SORCERERS_STRIP_RESISTANCES]: SORCERERS_STRIP_RESISTANCES_EFFECT,
  [ICE_MAGES_ATTACK_OR_BLOCK]: ICE_MAGES_ATTACK_OR_BLOCK_EFFECT,
  [ICE_MAGES_SIEGE_ATTACK]: ICE_MAGES_SIEGE_ATTACK_EFFECT,
  [ICE_MAGES_GAIN_MANA_CRYSTAL]: ICE_MAGES_GAIN_MANA_CRYSTAL_EFFECT,
  [FIRE_MAGES_ATTACK_OR_BLOCK]: FIRE_MAGES_ATTACK_OR_BLOCK_EFFECT,
  [FIRE_MAGES_GAIN_MANA_CRYSTAL]: FIRE_MAGES_GAIN_MANA_CRYSTAL_EFFECT,
  [HERBALIST_READY_UNIT]: HERBALIST_READY_UNIT_EFFECT,
  [HERBALIST_GAIN_MANA]: HERBALIST_GAIN_MANA_EFFECT,
  [ILLUSIONISTS_CANCEL_ATTACK]: ILLUSIONISTS_CANCEL_ATTACK_EFFECT,
  [ILLUSIONISTS_GAIN_WHITE_CRYSTAL]: ILLUSIONISTS_GAIN_WHITE_CRYSTAL_EFFECT,
  [SCOUTS_SCOUT_PEEK]: SCOUTS_SCOUT_PEEK_EFFECT,
  [SCOUTS_EXTENDED_MOVE]: SCOUTS_EXTENDED_MOVE_EFFECT,
  [UTEM_CROSSBOWMEN_ATTACK_OR_BLOCK]: UTEM_CROSSBOWMEN_ATTACK_OR_BLOCK_EFFECT,
  [ICE_GOLEMS_ATTACK_OR_BLOCK]: ICE_GOLEMS_ATTACK_OR_BLOCK_EFFECT,
  [THUGS_ATTACK]: THUGS_ATTACK_EFFECT,
  [THUGS_INFLUENCE]: THUGS_INFLUENCE_EFFECT,
  [SHOCKTROOPS_COORDINATED_FIRE]: SHOCKTROOPS_COORDINATED_FIRE_EFFECT,
  [SHOCKTROOPS_WEAKEN_ENEMY]: SHOCKTROOPS_WEAKEN_ENEMY_EFFECT,
  [SHOCKTROOPS_TAUNT]: SHOCKTROOPS_TAUNT_EFFECT,
  [ALTEM_GUARDIANS_GRANT_RESISTANCES]: ALTEM_GUARDIANS_GRANT_RESISTANCES_EFFECT,
  [ALTEM_MAGES_GAIN_TWO_MANA]: ALTEM_MAGES_GAIN_TWO_MANA_EFFECT,
  [ALTEM_MAGES_COLD_FIRE_ATTACK_OR_BLOCK]: ALTEM_MAGES_COLD_FIRE_ATTACK_OR_BLOCK_EFFECT,
  [ALTEM_MAGES_ATTACK_MODIFIER]: ALTEM_MAGES_ATTACK_MODIFIER_EFFECT,
  [AMOTEP_FREEZERS_FREEZE]: AMOTEP_FREEZERS_FREEZE_EFFECT,
};

/**
 * Get an effect by ID.
 * @param effectId - The effect ID to look up
 * @returns The CardEffect or undefined if not found
 */
export function getUnitAbilityEffect(effectId: string): CardEffect | undefined {
  return UNIT_ABILITY_EFFECTS[effectId];
}
