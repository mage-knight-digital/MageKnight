/**
 * Wings of Wind / Wings of Night (White Spell #23)
 *
 * Basic (Wings of Wind): Spend 1-5 move points and fly one space per point.
 *   Flight ignores terrain costs (1 point = 1 space).
 *   Can fly over water, keeps, mage towers, rampaging enemies.
 *   Must end in a safe space. Does not provoke rampaging enemies.
 *   Cannot explore tiles during flight.
 *
 * Powered (Wings of Night): Target enemy does not attack this combat.
 *   Additional enemies: pay 1 move for 2nd, 2 for 3rd, 3 for 4th, etc.
 *   No effect on Arcane Immune enemies.
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
  EFFECT_CHOICE,
  EFFECT_WINGS_OF_NIGHT,
} from "../../../types/effectTypes.js";
import {
  DURATION_TURN,
  EFFECT_TERRAIN_COST,
  EFFECT_RULE_OVERRIDE,
  RULE_IGNORE_RAMPAGING_PROVOKE,
  RULE_NO_EXPLORATION,
  TERRAIN_ALL,
} from "../../../types/modifierConstants.js";
import {
  MANA_WHITE,
  MANA_BLACK,
  CARD_WINGS_OF_WIND,
} from "@mage-knight/shared";

/**
 * Shared flight modifiers:
 * - All terrain costs 1 (each space = 1 move point, ignores terrain)
 * - Does not provoke rampaging enemies
 * - Cannot explore tiles
 */
const flightModifiers: readonly CardEffect[] = [
  // All terrain costs 1 (flight: 1 point per space regardless of terrain)
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
    description: "Flight: all terrain costs 1",
  },
  // Does not provoke rampaging enemies
  {
    type: EFFECT_APPLY_MODIFIER,
    modifier: {
      type: EFFECT_RULE_OVERRIDE,
      rule: RULE_IGNORE_RAMPAGING_PROVOKE,
    },
    duration: DURATION_TURN,
    description: "Flight does not provoke rampaging enemies",
  },
  // Cannot explore tiles during flight
  {
    type: EFFECT_APPLY_MODIFIER,
    modifier: {
      type: EFFECT_RULE_OVERRIDE,
      rule: RULE_NO_EXPLORATION,
    },
    duration: DURATION_TURN,
    description: "Cannot explore during flight",
  },
];

/**
 * Create a flight option for a given number of move points.
 * Each option is a compound effect: gain move points + apply flight modifiers.
 */
function flightOption(points: number): CardEffect {
  return {
    type: EFFECT_COMPOUND,
    effects: [
      { type: EFFECT_GAIN_MOVE, amount: points },
      ...flightModifiers,
    ],
  };
}

/**
 * Wings of Wind - Basic Effect
 *
 * Player chooses to spend 1-5 move points, then flies that many spaces.
 * Flight ignores terrain costs and does not provoke rampaging enemies.
 */
const wingsOfWindBasicEffect: CardEffect = {
  type: EFFECT_CHOICE,
  options: [
    flightOption(1),
    flightOption(2),
    flightOption(3),
    flightOption(4),
    flightOption(5),
  ],
};

export const WINGS_OF_WIND: DeedCard = {
  id: CARD_WINGS_OF_WIND,
  name: "Wings of Wind",
  poweredName: "Wings of Night",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_MOVEMENT],
  poweredEffectCategories: [CATEGORY_COMBAT],
  poweredBy: [MANA_BLACK, MANA_WHITE],
  basicEffect: wingsOfWindBasicEffect,
  poweredEffect: {
    type: EFFECT_WINGS_OF_NIGHT,
  },
  sidewaysValue: 1,
};
