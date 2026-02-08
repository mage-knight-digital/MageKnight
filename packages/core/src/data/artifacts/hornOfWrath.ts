/**
 * Horn of Wrath artifact
 * Card #09 (122/377)
 *
 * Basic: Siege Attack 5. Roll mana die - Wound if black or red.
 * Powered (any color, destroy): Siege Attack 5 + up to 5 more.
 *          Roll die per +1 added. Wound for each black or red rolled.
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_ARTIFACT,
} from "../../types/cards.js";
import {
  EFFECT_COMPOUND,
  EFFECT_ROLL_DIE_FOR_WOUND,
  EFFECT_CHOOSE_BONUS_WITH_RISK,
  COMBAT_TYPE_SIEGE,
} from "../../types/effectTypes.js";
import { siegeAttack } from "../effectHelpers.js";
import {
  CARD_HORN_OF_WRATH,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_BLACK,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";

const HORN_OF_WRATH: DeedCard = {
  id: CARD_HORN_OF_WRATH,
  name: "Horn of Wrath",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  categories: [CATEGORY_COMBAT],
  poweredBy: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE],
  basicEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      siegeAttack(5),
      {
        type: EFFECT_ROLL_DIE_FOR_WOUND,
        diceCount: 1,
        woundColors: [MANA_BLACK, MANA_RED],
      },
    ],
  },
  poweredEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      siegeAttack(5),
      {
        type: EFFECT_CHOOSE_BONUS_WITH_RISK,
        maxBonus: 5,
        attackType: COMBAT_TYPE_SIEGE,
        woundColors: [MANA_BLACK, MANA_RED],
      },
    ],
  },
  sidewaysValue: 1,
  destroyOnPowered: true,
};

export const HORN_OF_WRATH_CARDS: Record<CardId, DeedCard> = {
  [CARD_HORN_OF_WRATH]: HORN_OF_WRATH,
};
