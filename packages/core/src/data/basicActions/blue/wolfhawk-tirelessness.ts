import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_MOVEMENT, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { MANA_BLUE, CARD_WOLFHAWK_TIRELESSNESS } from "@mage-knight/shared";
import { move } from "../helpers.js";

/**
 * Wolfhawk's Tirelessness (replaces Stamina)
 */
export const WOLFHAWK_TIRELESSNESS: DeedCard = {
  id: CARD_WOLFHAWK_TIRELESSNESS,
  name: "Tirelessness",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_MOVEMENT],
  basicEffect: move(2),
  poweredEffect: move(4),
  sidewaysValue: 1,
};
