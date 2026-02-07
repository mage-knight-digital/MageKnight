/**
 * Space Bending / Time Bending (Blue Spell #16)
 *
 * Basic (Space Bending): Treat hexes at distance 2 as adjacent for movement
 *                        and exploration. Does not provoke rampaging enemies.
 *
 * Powered (Time Bending): At end of turn, played cards return to hand (not drawn
 *                         cards or discarded cards). Skip draw phase. Take an
 *                         immediate extra turn. Space Bending card is set aside
 *                         for rest of round. Cannot chain during Time Bent turn.
 */

import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_MOVEMENT,
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import {
  EFFECT_COMPOUND,
  EFFECT_APPLY_MODIFIER,
  EFFECT_NOOP,
} from "../../../types/effectTypes.js";
import {
  DURATION_TURN,
  EFFECT_RULE_OVERRIDE,
  RULE_SPACE_BENDING_ADJACENCY,
  RULE_IGNORE_RAMPAGING_PROVOKE,
  RULE_TIME_BENDING_ACTIVE,
} from "../../../types/modifierConstants.js";
import {
  MANA_BLUE,
  MANA_BLACK,
  CARD_SPACE_BENDING,
} from "@mage-knight/shared";

/**
 * Space Bending - Basic Effect
 *
 * Distance-2 adjacency for movement/exploration + no rampaging provoke.
 */
const spaceBendingBasicEffect = {
  type: EFFECT_COMPOUND,
  effects: [
    // Treat hexes at distance 2 as adjacent
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_RULE_OVERRIDE,
        rule: RULE_SPACE_BENDING_ADJACENCY,
      },
      duration: DURATION_TURN,
      description: "Hexes at distance 2 are adjacent",
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
  ],
} as const;

/**
 * Time Bending - Powered Effect
 *
 * End-of-turn logic handles card return, skip draw, and extra turn.
 * The powered effect just sets a modifier flag that the end-of-turn
 * system checks. The NOOP effect means no immediate game state change.
 */
const timeBendingPoweredEffect = {
  type: EFFECT_COMPOUND,
  effects: [
    // Mark Time Bending as active (checked during end-of-turn processing)
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_RULE_OVERRIDE,
        rule: RULE_TIME_BENDING_ACTIVE,
      },
      duration: DURATION_TURN,
      description: "Time Bending active",
    },
    // No immediate effect - all logic is in end-of-turn
    { type: EFFECT_NOOP },
  ],
} as const;

export const SPACE_BENDING: DeedCard = {
  id: CARD_SPACE_BENDING,
  name: "Space Bending",
  poweredName: "Time Bending",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_MOVEMENT],
  poweredEffectCategories: [CATEGORY_SPECIAL],
  poweredBy: [MANA_BLACK, MANA_BLUE],
  basicEffect: spaceBendingBasicEffect,
  poweredEffect: timeBendingPoweredEffect,
  sidewaysValue: 1,
};
