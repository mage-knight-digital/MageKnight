import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { MANA_BLUE, CARD_DETERMINATION } from "@mage-knight/shared";
import { attack, block, choice } from "../helpers.js";

export const DETERMINATION: DeedCard = {
  id: CARD_DETERMINATION,
  name: "Determination",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_COMBAT],
  basicEffect: choice(attack(2), block(2)),
  poweredEffect: block(5),
  sidewaysValue: 1,
};
