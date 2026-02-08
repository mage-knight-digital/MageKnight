/**
 * Endless Gem Pouch artifact
 * Card #11 (124/377)
 *
 * Basic: Roll mana die twice. Gain crystal per color rolled (choose if gold).
 *        Fame +1 instead of crystal if black rolled.
 * Powered (any color, destroy): Gain mana token of each basic color.
 *          Also get gold (day) or black (night/underground) mana token.
 *
 * FAQ S1: In dungeon/tomb, powered effect grants black mana token (not gold).
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_ARTIFACT,
} from "../../types/cards.js";
import {
  EFFECT_ROLL_FOR_CRYSTALS,
  EFFECT_COMPOUND,
  EFFECT_GAIN_MANA,
} from "../../types/effectTypes.js";
import { ifNightOrUnderground } from "../effectHelpers.js";
import {
  CARD_ENDLESS_GEM_POUCH,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_BLACK,
  MANA_GOLD,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";

const ENDLESS_GEM_POUCH: DeedCard = {
  id: CARD_ENDLESS_GEM_POUCH,
  name: "Endless Gem Pouch",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  categories: [CATEGORY_SPECIAL],
  poweredBy: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE],
  basicEffect: {
    type: EFFECT_ROLL_FOR_CRYSTALS,
    diceCount: 2,
  },
  poweredEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      { type: EFFECT_GAIN_MANA, color: MANA_RED },
      { type: EFFECT_GAIN_MANA, color: MANA_BLUE },
      { type: EFFECT_GAIN_MANA, color: MANA_GREEN },
      { type: EFFECT_GAIN_MANA, color: MANA_WHITE },
      ifNightOrUnderground(
        { type: EFFECT_GAIN_MANA, color: MANA_BLACK },
        { type: EFFECT_GAIN_MANA, color: MANA_GOLD },
      ),
    ],
  },
  sidewaysValue: 1,
  destroyOnPowered: true,
};

export const ENDLESS_GEM_POUCH_CARDS: Record<CardId, DeedCard> = {
  [CARD_ENDLESS_GEM_POUCH]: ENDLESS_GEM_POUCH,
};
