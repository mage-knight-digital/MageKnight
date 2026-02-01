import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_MOVEMENT, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { MANA_BLUE, CARD_STAMINA } from "@mage-knight/shared";
import { move } from "../helpers.js";

export const STAMINA: DeedCard = {
  id: CARD_STAMINA,
  name: "Stamina",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_MOVEMENT],
  basicEffect: move(2),
  poweredEffect: move(4),
  sidewaysValue: 1,
};
