import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_SPECIAL, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_RED, CARD_MAXIMAL_EFFECT } from "@mage-knight/shared";
import { maximalEffect } from "../helpers.js";

export const MAXIMAL_EFFECT: DeedCard = {
  id: CARD_MAXIMAL_EFFECT,
  name: "Maximal Effect",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_SPECIAL],
  // Basic: Throw away another Action card from your hand. Use the basic effect of that card three times.
  basicEffect: maximalEffect("basic", 3),
  // Powered: Throw away another Action card from your hand. Use the stronger effect of that card two times (for free).
  poweredEffect: maximalEffect("powered", 2),
  sidewaysValue: 1,
};
