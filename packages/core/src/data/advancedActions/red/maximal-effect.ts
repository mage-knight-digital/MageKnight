import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_SPECIAL, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_RED, CARD_MAXIMAL_EFFECT } from "@mage-knight/shared";
import { attack } from "../helpers.js";

export const MAXIMAL_EFFECT: DeedCard = {
  id: CARD_MAXIMAL_EFFECT,
  name: "Maximal Effect",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_SPECIAL],
  // Basic: When you play this, throw away another Action card from your hand. Use the basic effect of that card three times.
  // Powered: When you play this, throw away another Action card from your hand. Use the stronger effect of that card two times (for free).
  // TODO: Implement throw-away mechanic and effect multiplication
  basicEffect: attack(3),
  poweredEffect: attack(6),
  sidewaysValue: 1,
};
