import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_SPECIAL, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { MANA_GREEN, MANA_BLUE, MANA_WHITE, MANA_RED } from "@mage-knight/shared";
import { CARD_CONCENTRATION } from "@mage-knight/shared";
import { gainMana, cardBoost, choice } from "../helpers.js";

export const CONCENTRATION: DeedCard = {
  id: CARD_CONCENTRATION,
  name: "Concentration",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_GREEN],
  categories: [CATEGORY_SPECIAL],
  basicEffect: choice(gainMana(MANA_BLUE), gainMana(MANA_WHITE), gainMana(MANA_RED)),
  poweredEffect: cardBoost(2),
  sidewaysValue: 1,
};
