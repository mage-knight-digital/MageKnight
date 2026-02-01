import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_MOVEMENT, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { MANA_GREEN, CARD_MARCH } from "@mage-knight/shared";
import { move } from "../helpers.js";

export const MARCH: DeedCard = {
  id: CARD_MARCH,
  name: "March",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_GREEN],
  categories: [CATEGORY_MOVEMENT],
  basicEffect: move(2),
  poweredEffect: move(4),
  sidewaysValue: 1,
};
