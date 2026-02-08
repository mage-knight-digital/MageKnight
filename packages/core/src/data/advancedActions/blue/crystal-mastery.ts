import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_SPECIAL, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_BLUE, CARD_CRYSTAL_MASTERY } from "@mage-knight/shared";
import {
  EFFECT_CRYSTAL_MASTERY_BASIC,
  EFFECT_CRYSTAL_MASTERY_POWERED,
} from "../../../types/effectTypes.js";

export const CRYSTAL_MASTERY: DeedCard = {
  id: CARD_CRYSTAL_MASTERY,
  name: "Crystal Mastery",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_SPECIAL],
  // Basic: Gain a crystal to your Inventory of the same color as a crystal you already own.
  basicEffect: { type: EFFECT_CRYSTAL_MASTERY_BASIC },
  // Powered: At the end of the turn, any crystals you have spent this turn are returned to your Inventory.
  poweredEffect: { type: EFFECT_CRYSTAL_MASTERY_POWERED },
  sidewaysValue: 1,
};
