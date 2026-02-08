/**
 * Book of Wisdom artifact
 * Card #13 (126/377)
 *
 * Basic: Throw away Action card from hand. Gain Advanced Action
 *        of same color from offer to hand.
 * Powered (any color, destroy): Throw away Action card. Gain Spell of same color
 *        from offer to hand and crystal of that color.
 *
 * FAQ S1: Dual-colored Advanced Action cards can match EITHER one of the colors.
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_ARTIFACT,
} from "../../types/cards.js";
import { EFFECT_BOOK_OF_WISDOM } from "../../types/effectTypes.js";
import {
  CARD_BOOK_OF_WISDOM,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";

const BOOK_OF_WISDOM: DeedCard = {
  id: CARD_BOOK_OF_WISDOM,
  name: "Book of Wisdom",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  categories: [CATEGORY_SPECIAL],
  poweredBy: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE],
  basicEffect: {
    type: EFFECT_BOOK_OF_WISDOM,
    mode: "basic",
  },
  poweredEffect: {
    type: EFFECT_BOOK_OF_WISDOM,
    mode: "powered",
  },
  sidewaysValue: 1,
  destroyOnPowered: true,
};

export const BOOK_OF_WISDOM_CARDS: Record<CardId, DeedCard> = {
  [CARD_BOOK_OF_WISDOM]: BOOK_OF_WISDOM,
};
