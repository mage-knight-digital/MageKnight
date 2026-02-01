import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_HEALING, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { MANA_GREEN, CARD_NOROWAS_REJUVENATE } from "@mage-knight/shared";
import { heal, drawCards, gainMana, gainCrystal, readyUnit, choice } from "../helpers.js";

/**
 * Norowas's Rejuvenate (replaces Tranquility)
 */
export const NOROWAS_REJUVENATE: DeedCard = {
  id: CARD_NOROWAS_REJUVENATE,
  name: "Rejuvenate",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_GREEN],
  categories: [CATEGORY_HEALING],
  basicEffect: choice(heal(1), drawCards(1), gainMana(MANA_GREEN), readyUnit(2)),
  poweredEffect: choice(heal(2), drawCards(2), gainCrystal(MANA_GREEN), readyUnit(3)),
  sidewaysValue: 1,
};
