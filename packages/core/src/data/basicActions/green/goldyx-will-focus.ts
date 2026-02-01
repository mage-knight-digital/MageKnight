import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_SPECIAL, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { MANA_GREEN, MANA_BLUE, MANA_WHITE, MANA_RED, CARD_GOLDYX_WILL_FOCUS } from "@mage-knight/shared";
import { gainMana, gainCrystal, cardBoost, choice } from "../helpers.js";

/**
 * Goldyx's Will Focus (replaces Concentration)
 */
export const GOLDYX_WILL_FOCUS: DeedCard = {
  id: CARD_GOLDYX_WILL_FOCUS,
  name: "Will Focus",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_GREEN],
  categories: [CATEGORY_SPECIAL],
  basicEffect: choice(
    gainMana(MANA_BLUE),
    gainMana(MANA_WHITE),
    gainMana(MANA_RED),
    gainCrystal(MANA_GREEN)
  ),
  poweredEffect: cardBoost(3),
  sidewaysValue: 1,
};
