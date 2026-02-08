/**
 * Amulet of Darkness artifact
 * Card #15 (128/377)
 *
 * Basic: Gain mana token of any color. At Day: deserts cost 3 to move,
 *        can use black mana as if Night (including taking black dice from Source).
 * Powered (any color, destroy): Same as basic but gain three mana tokens of any colors.
 *
 * FAQ S1:
 * - Can gain black mana token(s) if desired
 * - Can take black mana DICE from Source (normally black depleted during day)
 * - Black mana usable day or night from ANY source
 * - Can use black for spell powered effects
 * - Gold mana: still usable during day, but NOT usable at night
 * - "Night Rules" don't fully apply - just black mana access
 * - Forest movement cost remains 3 at day (already 3)
 * - Day/Night Skills still use DAY values
 * - See Amulet of the Sun for counterpart
 */

import type { DeedCard, CardEffect } from "../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_ARTIFACT,
} from "../../types/cards.js";
import {
  EFFECT_COMPOUND,
  EFFECT_CHOICE,
  EFFECT_GAIN_MANA,
  EFFECT_APPLY_MODIFIER,
} from "../../types/effectTypes.js";
import { ifDay } from "../effectHelpers.js";
import {
  CARD_AMULET_OF_DARKNESS,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_BLACK,
  MANA_GOLD,
  TERRAIN_DESERT,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import {
  DURATION_TURN,
  EFFECT_TERRAIN_COST,
  EFFECT_RULE_OVERRIDE,
  RULE_ALLOW_BLACK_AT_DAY,
} from "../../types/modifierConstants.js";

/**
 * Choice effect for gaining one mana token of any color.
 * Player can choose from all 6 colors (red, blue, green, white, black, gold).
 */
const anyColorManaChoice: CardEffect = {
  type: EFFECT_CHOICE,
  options: [
    { type: EFFECT_GAIN_MANA, color: MANA_RED },
    { type: EFFECT_GAIN_MANA, color: MANA_BLUE },
    { type: EFFECT_GAIN_MANA, color: MANA_GREEN },
    { type: EFFECT_GAIN_MANA, color: MANA_WHITE },
    { type: EFFECT_GAIN_MANA, color: MANA_BLACK },
    { type: EFFECT_GAIN_MANA, color: MANA_GOLD },
  ],
};

/**
 * Day modifiers applied by the Amulet of Darkness:
 * 1. Desert movement cost reduced to 3 (night cost)
 * 2. Black mana can be used (including black dice from Source)
 */
const dayModifiers: CardEffect = {
  type: EFFECT_COMPOUND,
  effects: [
    // Desert movement cost reduced to 3 (replaces day cost of 5)
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_TERRAIN_COST,
        terrain: TERRAIN_DESERT,
        amount: 0,
        minimum: 0,
        replaceCost: 3,
      },
      duration: DURATION_TURN,
      description: "Deserts cost 3 movement",
    },
    // Allow black mana usage at day + black dice from Source
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_RULE_OVERRIDE,
        rule: RULE_ALLOW_BLACK_AT_DAY,
      },
      duration: DURATION_TURN,
      description: "Black mana can be used during the day",
    },
  ],
};

/**
 * Create the full effect: gain any-color mana + conditional day modifiers
 */
function createAmuletEffect(manaCount: number): CardEffect {
  const manaEffects: CardEffect[] = [];
  for (let i = 0; i < manaCount; i++) {
    manaEffects.push(anyColorManaChoice);
  }

  return {
    type: EFFECT_COMPOUND,
    effects: [
      ...manaEffects,
      ifDay(dayModifiers),
    ],
  };
}

const AMULET_OF_DARKNESS: DeedCard = {
  id: CARD_AMULET_OF_DARKNESS,
  name: "Amulet of Darkness",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  categories: [CATEGORY_SPECIAL],
  poweredBy: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE],
  basicEffect: createAmuletEffect(1),
  poweredEffect: createAmuletEffect(3),
  sidewaysValue: 1,
  destroyOnPowered: true,
};

export const AMULET_OF_DARKNESS_CARDS: Record<CardId, DeedCard> = {
  [CARD_AMULET_OF_DARKNESS]: AMULET_OF_DARKNESS,
};
