/**
 * Temporal Portal (Blue Advanced Action)
 *
 * Basic: Play as your action for this turn. You may move to an adjacent
 *        revealed safe space (without provoking rampaging monsters).
 *        Whether you move or not, your Hand limit is higher by 1 the
 *        next time you draw cards.
 *
 * Powered: As above, except you can either move two spaces to a revealed
 *          safe space instead of one, or get your Hand limit increased
 *          by 2 instead of 1.
 *
 * Implementation Notes:
 * - "Play as action" is handled via CATEGORY_ACTION. playCardCommand sets
 *   hasTakenActionThisTurn = true, and validators prevent playing when
 *   action is already used.
 * - Movement uses standard move points with terrain cost = 1 for all terrain
 *   (including lakes/mountains), no rampaging provocation.
 * - Hand limit bonus uses the meditationHandLimitBonus field via EFFECT_HAND_LIMIT_BONUS.
 * - Powered choice: (Move 2 + HL+1) OR (Move 0-1 + HL+2).
 */

import type { DeedCard, CardEffect } from "../../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  CATEGORY_ACTION,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../../types/cards.js";
import {
  EFFECT_COMPOUND,
  EFFECT_GAIN_MOVE,
  EFFECT_APPLY_MODIFIER,
  EFFECT_CHOICE,
  EFFECT_HAND_LIMIT_BONUS,
} from "../../../types/effectTypes.js";
import {
  DURATION_TURN,
  EFFECT_TERRAIN_COST,
  EFFECT_RULE_OVERRIDE,
  RULE_IGNORE_RAMPAGING_PROVOKE,
  TERRAIN_ALL,
} from "../../../types/modifierConstants.js";
import {
  MANA_BLUE,
  CARD_TEMPORAL_PORTAL,
} from "@mage-knight/shared";

/**
 * Shared movement modifiers for Temporal Portal:
 * - All terrain costs 1 (can traverse lakes/mountains)
 * - Does not provoke rampaging enemies
 */
const portalMovementModifiers: readonly CardEffect[] = [
  // All terrain costs 1 (each space = 1 move point, including lakes/mountains)
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
 * Temporal Portal - Basic Effect
 *
 * Move 1 (optional, all terrain cost 1, no rampaging) + Hand limit +1.
 */
const temporalPortalBasicEffect: CardEffect = {
  type: EFFECT_COMPOUND,
  effects: [
    { type: EFFECT_GAIN_MOVE, amount: 1 },
    ...portalMovementModifiers,
    { type: EFFECT_HAND_LIMIT_BONUS, bonus: 1 },
  ],
};

/**
 * Temporal Portal - Powered Effect
 *
 * Choice between:
 * Option 1: Move 2 (all terrain cost 1, no rampaging) + Hand limit +1
 * Option 2: Move 1 (all terrain cost 1, no rampaging) + Hand limit +2
 */
const temporalPortalPoweredEffect: CardEffect = {
  type: EFFECT_CHOICE,
  options: [
    // Option 1: Move 2 + Hand limit +1
    {
      type: EFFECT_COMPOUND,
      effects: [
        { type: EFFECT_GAIN_MOVE, amount: 2 },
        ...portalMovementModifiers,
        { type: EFFECT_HAND_LIMIT_BONUS, bonus: 1 },
      ],
    },
    // Option 2: Move 1 + Hand limit +2
    {
      type: EFFECT_COMPOUND,
      effects: [
        { type: EFFECT_GAIN_MOVE, amount: 1 },
        ...portalMovementModifiers,
        { type: EFFECT_HAND_LIMIT_BONUS, bonus: 2 },
      ],
    },
  ],
};

export const TEMPORAL_PORTAL: DeedCard = {
  id: CARD_TEMPORAL_PORTAL,
  name: "Temporal Portal",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_SPECIAL, CATEGORY_ACTION],
  basicEffect: temporalPortalBasicEffect,
  poweredEffect: temporalPortalPoweredEffect,
  sidewaysValue: 1,
};
