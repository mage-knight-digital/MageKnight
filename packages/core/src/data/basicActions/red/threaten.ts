import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_INFLUENCE, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { MANA_RED, CARD_THREATEN } from "@mage-knight/shared";
import { influence, compound, changeReputation } from "../helpers.js";

export const THREATEN: DeedCard = {
  id: CARD_THREATEN,
  name: "Threaten",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_INFLUENCE],
  // Basic: Influence 2 | Powered: Influence 5, Reputation -1
  basicEffect: influence(2),
  poweredEffect: compound(influence(5), changeReputation(-1)),
  sidewaysValue: 1,
};
