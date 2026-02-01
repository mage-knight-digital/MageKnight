import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../../types/cards.js";
import { MANA_GREEN, CARD_CRUSHING_BOLT } from "@mage-knight/shared";
import { gainCrystal, siegeAttack } from "../helpers.js";

export const CRUSHING_BOLT: DeedCard = {
  id: CARD_CRUSHING_BOLT,
  name: "Crushing Bolt",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_GREEN],
  categories: [CATEGORY_SPECIAL, CATEGORY_COMBAT],
  // Basic: Gain a green crystal to your Inventory
  // Powered: Siege Attack 3
  basicEffect: gainCrystal(MANA_GREEN),
  poweredEffect: siegeAttack(3),
  sidewaysValue: 1,
};
