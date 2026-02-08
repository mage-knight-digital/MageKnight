/**
 * Amulet of the Sun artifact
 * Card #14 (127/377)
 *
 * Basic: Gain 1 gold mana token. At Night: forests cost 3 to move,
 *        can use gold mana, reveal garrisons of nearby fortified sites as if Day.
 * Powered (any color, destroy): Same as basic but gain 3 gold mana tokens.
 *
 * FAQ S1:
 * - Desert movement cost remains 3 at night (already 3)
 * - Can still use black mana at night
 * - Gold mana CANNOT be converted to black mana
 * - Day/night Skills (Day Sharpshooting, Dark Negotiation, etc.) still use NIGHT values
 * - See Amulet of Darkness for counterpart
 */

import type { DeedCard, CardEffect } from "../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_ARTIFACT,
} from "../../types/cards.js";
import {
  EFFECT_COMPOUND,
  EFFECT_GAIN_MANA,
  EFFECT_APPLY_MODIFIER,
  EFFECT_REVEAL_TILES,
} from "../../types/effectTypes.js";
import { ifNight } from "../effectHelpers.js";
import {
  CARD_AMULET_OF_THE_SUN,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_GOLD,
  TERRAIN_FOREST,
  REVEAL_TILE_TYPE_GARRISON,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import {
  DURATION_TURN,
  EFFECT_TERRAIN_COST,
  EFFECT_RULE_OVERRIDE,
  RULE_ALLOW_GOLD_AT_NIGHT,
} from "../../types/modifierConstants.js";

/**
 * Night modifiers applied by the Amulet of the Sun:
 * 1. Forest movement cost reduced to 3 (day cost)
 * 2. Gold mana can be used
 * 3. Reveal garrisons of nearby fortified sites and ruins as if day
 */
const nightModifiers: CardEffect = {
  type: EFFECT_COMPOUND,
  effects: [
    // Forest movement cost reduced to 3 (replaces night cost of 5)
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_TERRAIN_COST,
        terrain: TERRAIN_FOREST,
        amount: 0,
        minimum: 0,
        replaceCost: 3,
      },
      duration: DURATION_TURN,
      description: "Forests cost 3 movement",
    },
    // Allow gold mana usage at night
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_RULE_OVERRIDE,
        rule: RULE_ALLOW_GOLD_AT_NIGHT,
      },
      duration: DURATION_TURN,
      description: "Gold mana can be used at night",
    },
    // Reveal garrisons of nearby fortified sites and ruins as if day
    {
      type: EFFECT_REVEAL_TILES,
      distance: 1,
      tileType: REVEAL_TILE_TYPE_GARRISON,
    },
  ],
};

/**
 * Create the full effect: gain gold mana + conditional night modifiers
 */
function createAmuletEffect(manaCount: number): CardEffect {
  const manaEffects: CardEffect[] = [];
  for (let i = 0; i < manaCount; i++) {
    manaEffects.push({ type: EFFECT_GAIN_MANA, color: MANA_GOLD });
  }

  return {
    type: EFFECT_COMPOUND,
    effects: [
      ...manaEffects,
      ifNight(nightModifiers),
    ],
  };
}

const AMULET_OF_THE_SUN: DeedCard = {
  id: CARD_AMULET_OF_THE_SUN,
  name: "Amulet of the Sun",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  categories: [CATEGORY_SPECIAL],
  poweredBy: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE],
  basicEffect: createAmuletEffect(1),
  poweredEffect: createAmuletEffect(3),
  sidewaysValue: 1,
  destroyOnPowered: true,
};

export const AMULET_OF_THE_SUN_CARDS: Record<CardId, DeedCard> = {
  [CARD_AMULET_OF_THE_SUN]: AMULET_OF_THE_SUN,
};
