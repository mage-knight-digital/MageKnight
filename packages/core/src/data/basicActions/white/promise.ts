import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_INFLUENCE, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { MANA_WHITE, CARD_PROMISE } from "@mage-knight/shared";
import { influence } from "../helpers.js";

export const PROMISE: DeedCard = {
  id: CARD_PROMISE,
  name: "Promise",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CATEGORY_INFLUENCE],
  // Basic: Influence 2 | Powered: Influence 4
  basicEffect: influence(2),
  poweredEffect: influence(4),
  sidewaysValue: 1,
};
