import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_INFLUENCE, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { MANA_RED, CARD_KRANG_RUTHLESS_COERCION } from "@mage-knight/shared";
import { influence } from "../helpers.js";

/**
 * Krang's Ruthless Coercion (replaces Threaten)
 */
export const KRANG_RUTHLESS_COERCION: DeedCard = {
  id: CARD_KRANG_RUTHLESS_COERCION,
  name: "Ruthless Coercion",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_INFLUENCE],
  // Basic: Influence 2. May get -2 discount to recruit one Unit; if recruited, Reputation -1
  // Powered: Influence 6, Reputation -1. May ready Level I and II Units for 2 Influence/level
  // Note: Recruitment/ready mechanics not modeled
  basicEffect: influence(2),
  poweredEffect: influence(6),
  sidewaysValue: 1,
};
