/**
 * Underground Travel / Underground Attack (Green Spell #04)
 *
 * Basic (Underground Travel):
 *   Move by up to 3 revealed spaces on the map. You may not move to or
 *   through swamps or lakes. Must end on a safe space. Does not provoke
 *   rampaging enemies.
 *
 * Powered (Underground Attack):
 *   Same movement rules as basic, except must end on a fortified site
 *   (or space occupied by another player). Ends your movement and counts
 *   as an assault. Ignore site fortifications. If withdrawing after combat,
 *   return to original position.
 *
 * Implementation:
 *   Both effects use Move 3 with all terrain costing 1 (each space = 1 move point),
 *   terrain prohibition for swamp/lake, and rampaging provocation bypass.
 *   The powered effect additionally ignores site fortification.
 *   Assault initiation and withdrawal are handled by the existing movement/combat system.
 */

import type { DeedCard, CardEffect } from "../../../types/cards.js";
import {
  CATEGORY_MOVEMENT,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import {
  EFFECT_COMPOUND,
  EFFECT_GAIN_MOVE,
  EFFECT_APPLY_MODIFIER,
} from "../../../types/effectTypes.js";
import {
  DURATION_TURN,
  EFFECT_TERRAIN_COST,
  EFFECT_TERRAIN_PROHIBITION,
  EFFECT_RULE_OVERRIDE,
  RULE_IGNORE_RAMPAGING_PROVOKE,
  RULE_IGNORE_FORTIFICATION,
  TERRAIN_ALL,
} from "../../../types/modifierConstants.js";
import {
  MANA_GREEN,
  MANA_BLACK,
  CARD_UNDERGROUND_TRAVEL,
  TERRAIN_SWAMP,
  TERRAIN_LAKE,
} from "@mage-knight/shared";

/**
 * Shared modifiers for both basic and powered effects:
 * - All terrain costs 1 (each space = 1 move point)
 * - Cannot enter swamps or lakes
 * - Does not provoke rampaging enemies
 */
const undergroundMovementModifiers: readonly CardEffect[] = [
  // All terrain costs 1 (each revealed space = 1 move point)
  {
    type: EFFECT_APPLY_MODIFIER,
    modifier: {
      type: EFFECT_TERRAIN_COST,
      terrain: TERRAIN_ALL,
      amount: 0,
      minimum: 0,
      replaceCost: 1,
    },
    duration: DURATION_TURN,
    description: "All terrain costs 1",
  },
  // Cannot enter swamps or lakes
  {
    type: EFFECT_APPLY_MODIFIER,
    modifier: {
      type: EFFECT_TERRAIN_PROHIBITION,
      prohibitedTerrains: [TERRAIN_SWAMP, TERRAIN_LAKE],
    },
    duration: DURATION_TURN,
    description: "Cannot enter swamps or lakes",
  },
  // Does not provoke rampaging enemies
  {
    type: EFFECT_APPLY_MODIFIER,
    modifier: {
      type: EFFECT_RULE_OVERRIDE,
      rule: RULE_IGNORE_RAMPAGING_PROVOKE,
    },
    duration: DURATION_TURN,
    description: "Does not provoke rampaging enemies",
  },
];

/**
 * Underground Travel - Basic Effect
 *
 * Move 3 with all terrain costing 1, no swamp/lake, no rampaging provocation.
 */
const undergroundTravelBasicEffect = {
  type: EFFECT_COMPOUND,
  effects: [
    { type: EFFECT_GAIN_MOVE, amount: 3 },
    ...undergroundMovementModifiers,
  ],
} as const;

/**
 * Underground Attack - Powered Effect
 *
 * Same movement + ignore site fortifications.
 * Must end on a fortified site (enforced by player choice — the movement system
 * naturally triggers assault when entering a fortified site).
 * Withdrawal returns to original position (handled by moveCommand's assaultOrigin).
 */
const undergroundAttackPoweredEffect = {
  type: EFFECT_COMPOUND,
  effects: [
    { type: EFFECT_GAIN_MOVE, amount: 3 },
    ...undergroundMovementModifiers,
    // Ignore site fortifications
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_RULE_OVERRIDE,
        rule: RULE_IGNORE_FORTIFICATION,
      },
      duration: DURATION_TURN,
      description: "Ignore site fortifications",
    },
  ],
} as const;

export const UNDERGROUND_TRAVEL: DeedCard = {
  id: CARD_UNDERGROUND_TRAVEL,
  name: "Underground Travel",
  poweredName: "Underground Attack",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_MOVEMENT],
  poweredEffectCategories: [CATEGORY_MOVEMENT, CATEGORY_COMBAT],
  poweredBy: [MANA_BLACK, MANA_GREEN],
  basicEffect: undergroundTravelBasicEffect,
  poweredEffect: undergroundAttackPoweredEffect,
  sidewaysValue: 1,
};
