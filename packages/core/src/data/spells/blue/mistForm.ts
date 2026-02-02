/**
 * Mist Form / Veil of Mist (Blue Spell #14)
 *
 * Basic (Mist Form): Move 4. All terrain costs 2 (including lakes).
 *                    Cannot enter hills or mountains for rest of turn.
 *
 * Powered (Veil of Mist): All units gain all resistances this turn.
 *                         Hero ignores first wound from enemies this turn
 *                         (including Poison/Paralyze effects).
 */

import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_MOVEMENT,
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import {
  EFFECT_COMPOUND,
  EFFECT_GAIN_MOVE,
  EFFECT_APPLY_MODIFIER,
  EFFECT_GRANT_WOUND_IMMUNITY,
} from "../../../types/effectTypes.js";
import {
  DURATION_TURN,
  EFFECT_TERRAIN_COST,
  EFFECT_TERRAIN_PROHIBITION,
  EFFECT_GRANT_RESISTANCES,
  TERRAIN_ALL,
  SCOPE_ALL_UNITS,
} from "../../../types/modifierConstants.js";
import {
  MANA_BLUE,
  MANA_BLACK,
  CARD_MIST_FORM,
  TERRAIN_HILLS,
  TERRAIN_MOUNTAIN,
  RESIST_PHYSICAL,
  RESIST_FIRE,
  RESIST_ICE,
} from "@mage-knight/shared";

/**
 * Mist Form - Basic Effect
 *
 * Move 4, all terrain costs 2 (including lakes), cannot enter hills/mountains.
 */
const mistFormBasicEffect = {
  type: EFFECT_COMPOUND,
  effects: [
    // Grant Move 4
    { type: EFFECT_GAIN_MOVE, amount: 4 },
    // All terrain costs 2 (including lakes - makes them passable)
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_TERRAIN_COST,
        terrain: TERRAIN_ALL,
        amount: 0, // Ignored when replaceCost is set
        minimum: 0, // Allow terrain to cost exactly 2
        replaceCost: 2, // Replace base cost with 2
      },
      duration: DURATION_TURN,
      description: "All terrain costs 2",
    },
    // Cannot enter hills or mountains
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_TERRAIN_PROHIBITION,
        prohibitedTerrains: [TERRAIN_HILLS, TERRAIN_MOUNTAIN],
      },
      duration: DURATION_TURN,
      description: "Cannot enter hills or mountains",
    },
  ],
} as const;

/**
 * Veil of Mist - Powered Effect
 *
 * All units gain all resistances. Hero ignores first wound from enemies.
 */
const veilOfMistPoweredEffect = {
  type: EFFECT_COMPOUND,
  effects: [
    // All units gain all resistances
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_GRANT_RESISTANCES,
        resistances: [RESIST_PHYSICAL, RESIST_FIRE, RESIST_ICE],
      },
      duration: DURATION_TURN,
      scope: { type: SCOPE_ALL_UNITS },
      description: "All units gain all resistances",
    },
    // Hero ignores first wound
    { type: EFFECT_GRANT_WOUND_IMMUNITY },
  ],
} as const;

export const MIST_FORM: DeedCard = {
  id: CARD_MIST_FORM,
  name: "Mist Form",
  poweredName: "Veil of Mist",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_MOVEMENT, CATEGORY_SPECIAL],
  poweredBy: [MANA_BLACK, MANA_BLUE],
  basicEffect: mistFormBasicEffect,
  poweredEffect: veilOfMistPoweredEffect,
  sidewaysValue: 1,
};
