import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_HEALING, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { MANA_GREEN, CARD_TRANQUILITY } from "@mage-knight/shared";
import { heal, drawCards, choice } from "../helpers.js";

export const TRANQUILITY: DeedCard = {
  id: CARD_TRANQUILITY,
  name: "Tranquility",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_GREEN],
  categories: [CATEGORY_HEALING],
  basicEffect: choice(heal(1), drawCards(1)),
  poweredEffect: choice(heal(2), drawCards(2)),
  sidewaysValue: 1,
};
