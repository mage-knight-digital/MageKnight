import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../../types/cards.js";
import { MANA_BLUE, CARD_ICE_BOLT } from "@mage-knight/shared";
import { gainCrystal, rangedAttackWithElement, ELEMENT_ICE } from "../helpers.js";

export const ICE_BOLT: DeedCard = {
  id: CARD_ICE_BOLT,
  name: "Ice Bolt",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_SPECIAL, CATEGORY_COMBAT],
  // Basic: Gain a blue crystal to your Inventory
  // Powered: Ranged Ice Attack 3
  basicEffect: gainCrystal(MANA_BLUE),
  poweredEffect: rangedAttackWithElement(3, ELEMENT_ICE),
  sidewaysValue: 1,
};
