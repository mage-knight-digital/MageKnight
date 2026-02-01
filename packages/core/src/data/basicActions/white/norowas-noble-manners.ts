import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_INFLUENCE, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { MANA_WHITE, CARD_NOROWAS_NOBLE_MANNERS } from "@mage-knight/shared";
import { influence } from "../helpers.js";

/**
 * Norowas's Noble Manners (replaces Promise)
 */
export const NOROWAS_NOBLE_MANNERS: DeedCard = {
  id: CARD_NOROWAS_NOBLE_MANNERS,
  name: "Noble Manners",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CATEGORY_INFLUENCE],
  // Basic: Influence 2. If used during interaction: Fame +1 at end of turn
  // Powered: Influence 4. If used during interaction: Fame +1 and Reputation +1
  // Note: Fame/Rep bonuses not modeled
  basicEffect: influence(2),
  poweredEffect: influence(4),
  sidewaysValue: 1,
};
