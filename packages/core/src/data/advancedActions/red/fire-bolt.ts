import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../../types/cards.js";
import { MANA_RED, CARD_FIRE_BOLT } from "@mage-knight/shared";
import { gainCrystal, rangedAttackWithElement, ELEMENT_FIRE } from "../helpers.js";

export const FIRE_BOLT: DeedCard = {
  id: CARD_FIRE_BOLT,
  name: "Fire Bolt",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_SPECIAL, CATEGORY_COMBAT],
  // Basic: Gain a red crystal to your Inventory
  // Powered: Ranged Fire Attack 3
  basicEffect: gainCrystal(MANA_RED),
  poweredEffect: rangedAttackWithElement(3, ELEMENT_FIRE),
  sidewaysValue: 1,
};
