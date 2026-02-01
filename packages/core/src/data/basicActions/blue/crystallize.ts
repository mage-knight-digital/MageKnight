import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_SPECIAL, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { MANA_BLUE, MANA_RED, MANA_GREEN, MANA_WHITE, CARD_CRYSTALLIZE } from "@mage-knight/shared";
import { convertManaToCrystal, gainCrystal, choice } from "../helpers.js";

export const CRYSTALLIZE: DeedCard = {
  id: CARD_CRYSTALLIZE,
  name: "Crystallize",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_SPECIAL],
  basicEffect: convertManaToCrystal(),
  poweredEffect: choice(
    gainCrystal(MANA_RED),
    gainCrystal(MANA_BLUE),
    gainCrystal(MANA_GREEN),
    gainCrystal(MANA_WHITE)
  ),
  sidewaysValue: 1,
};
