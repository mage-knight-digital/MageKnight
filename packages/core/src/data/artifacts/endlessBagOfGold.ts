/**
 * Endless Bag of Gold artifact
 * Card #10 (123/377)
 *
 * Basic: Influence 4, Fame +2
 * Powered (black): Influence 9, Fame +3 (card destroyed)
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CATEGORY_INFLUENCE,
  DEED_CARD_TYPE_ARTIFACT,
} from "../../types/cards.js";
import { EFFECT_COMPOUND } from "../../types/effectTypes.js";
import { CARD_ENDLESS_BAG_OF_GOLD, MANA_BLACK } from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import { influence, fame } from "../effectHelpers.js";

const ENDLESS_BAG_OF_GOLD: DeedCard = {
  id: CARD_ENDLESS_BAG_OF_GOLD,
  name: "Endless Bag of Gold",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  categories: [CATEGORY_INFLUENCE],
  poweredBy: [MANA_BLACK],
  basicEffect: {
    type: EFFECT_COMPOUND,
    effects: [influence(4), fame(2)],
  },
  poweredEffect: {
    type: EFFECT_COMPOUND,
    effects: [influence(9), fame(3)],
  },
  sidewaysValue: 2,
  destroyOnPowered: true,
};

export const ENDLESS_BAG_OF_GOLD_CARDS: Record<CardId, DeedCard> = {
  [CARD_ENDLESS_BAG_OF_GOLD]: ENDLESS_BAG_OF_GOLD,
};
