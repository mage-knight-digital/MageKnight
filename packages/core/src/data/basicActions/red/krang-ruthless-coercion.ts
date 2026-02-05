import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_INFLUENCE, CATEGORY_HEALING, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { MANA_RED, CARD_KRANG_RUTHLESS_COERCION } from "@mage-knight/shared";
import { influence, compound, changeReputation, recruitDiscount, readyUnitsForInfluence } from "../helpers.js";

/**
 * Krang's Ruthless Coercion (replaces Threaten)
 *
 * Basic: Influence 2. You may get a discount of 2 towards the cost of
 *   recruiting one Unit. If you recruit that unit this turn, Reputation -1.
 *
 * Powered (Red): Influence 6. Reputation -1. You may ready Level I and II
 *   Units you control by paying 2 Influence per level of Unit.
 */
export const KRANG_RUTHLESS_COERCION: DeedCard = {
  id: CARD_KRANG_RUTHLESS_COERCION,
  name: "Ruthless Coercion",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_INFLUENCE],
  poweredEffectCategories: [CATEGORY_INFLUENCE, CATEGORY_HEALING],
  basicEffect: compound(
    influence(2),
    recruitDiscount(2, -1),
  ),
  poweredEffect: compound(
    influence(6),
    changeReputation(-1),
    readyUnitsForInfluence(2, 2),
  ),
  sidewaysValue: 1,
};
