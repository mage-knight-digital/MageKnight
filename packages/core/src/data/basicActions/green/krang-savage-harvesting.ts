import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_MOVEMENT, CATEGORY_SPECIAL, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { MANA_GREEN, CARD_KRANG_SAVAGE_HARVESTING } from "@mage-knight/shared";
import { move } from "../helpers.js";

/**
 * Krang's Savage Harvesting (replaces March)
 */
export const KRANG_SAVAGE_HARVESTING: DeedCard = {
  id: CARD_KRANG_SAVAGE_HARVESTING,
  name: "Savage Harvesting",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_GREEN],
  categories: [CATEGORY_MOVEMENT, CATEGORY_SPECIAL],
  basicEffect: move(2),
  poweredEffect: move(4),
  sidewaysValue: 1,
};
