import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_MOVEMENT, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { MANA_GREEN, CARD_BRAEVALAR_DRUIDIC_PATHS } from "@mage-knight/shared";
import { move } from "../helpers.js";

/**
 * Braevalar's Druidic Paths (replaces March)
 */
export const BRAEVALAR_DRUIDIC_PATHS: DeedCard = {
  id: CARD_BRAEVALAR_DRUIDIC_PATHS,
  name: "Druidic Paths",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_GREEN],
  categories: [CATEGORY_MOVEMENT],
  basicEffect: move(2),
  poweredEffect: move(4),
  sidewaysValue: 1,
};
