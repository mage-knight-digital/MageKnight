import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_MOVEMENT,
  CATEGORY_HEALING,
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../../types/cards.js";
import { MANA_GREEN, MANA_BLUE, CARD_POWER_OF_CRYSTALS } from "@mage-knight/shared";
import {
  EFFECT_POWER_OF_CRYSTALS_BASIC,
  EFFECT_POWER_OF_CRYSTALS_POWERED,
} from "../../../types/effectTypes.js";

export const POWER_OF_CRYSTALS: DeedCard = {
  id: CARD_POWER_OF_CRYSTALS,
  name: "Power of Crystals",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_GREEN, MANA_BLUE], // Dual-color: can be powered by green OR blue
  categories: [CATEGORY_MOVEMENT, CATEGORY_HEALING, CATEGORY_SPECIAL],
  // Basic: Gain a crystal to your Inventory of a basic color you do not already own.
  // Powered: Move 4, or Heal 2, or draw two cards. For each set of four different color crystals in your Inventory: Move 2, or Heal 1, or draw a card.
  basicEffect: { type: EFFECT_POWER_OF_CRYSTALS_BASIC },
  poweredEffect: { type: EFFECT_POWER_OF_CRYSTALS_POWERED },
  sidewaysValue: 1,
};
