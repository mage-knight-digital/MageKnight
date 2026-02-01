import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_MOVEMENT,
  CATEGORY_HEALING,
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../../types/cards.js";
import { MANA_GREEN, MANA_BLUE, CARD_POWER_OF_CRYSTALS } from "@mage-knight/shared";
import { move, heal, choice, gainCrystal } from "../helpers.js";

export const POWER_OF_CRYSTALS: DeedCard = {
  id: CARD_POWER_OF_CRYSTALS,
  name: "Power of Crystals",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_GREEN, MANA_BLUE], // Dual-color: can be powered by green OR blue
  categories: [CATEGORY_MOVEMENT, CATEGORY_HEALING, CATEGORY_SPECIAL],
  // Basic: Gain a crystal to your Inventory of a basic color you do not already own.
  // Powered: Move 4, or Heal 2, or draw two cards. For each set of four different color crystals in your Inventory: Move 2, or Heal 1, or draw a card.
  // TODO: Implement crystal-set scaling and card draw
  basicEffect: gainCrystal(MANA_GREEN),
  poweredEffect: choice(move(4), heal(2)),
  sidewaysValue: 1,
};
