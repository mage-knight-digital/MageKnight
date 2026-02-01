import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_SPECIAL, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  CARD_GOLDYX_CRYSTAL_JOY,
} from "@mage-knight/shared";
import { drawCards } from "../helpers.js";

/**
 * Goldyx's Crystal Joy (replaces Crystallize)
 * Can be powered by any basic mana color
 */
export const GOLDYX_CRYSTAL_JOY: DeedCard = {
  id: CARD_GOLDYX_CRYSTAL_JOY,
  name: "Crystal Joy",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  // Can be powered by any basic mana color
  poweredBy: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE],
  categories: [CATEGORY_SPECIAL],
  // Basic: Pay mana, gain crystal. At end of turn, may discard non-Wound to return to hand
  // Powered: (same as basic)
  // Note: Crystal manipulation not modeled - placeholder
  basicEffect: drawCards(0), // Placeholder
  poweredEffect: drawCards(0), // Placeholder
  sidewaysValue: 1,
};
