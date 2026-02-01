import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../../types/cards.js";
import { MANA_WHITE, CARD_SWIFT_BOLT } from "@mage-knight/shared";
import { gainCrystal, rangedAttack } from "../helpers.js";

export const SWIFT_BOLT: DeedCard = {
  id: CARD_SWIFT_BOLT,
  name: "Swift Bolt",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CATEGORY_SPECIAL, CATEGORY_COMBAT],
  // Basic: Gain a white crystal to your Inventory
  // Powered: Ranged Attack 4
  basicEffect: gainCrystal(MANA_WHITE),
  poweredEffect: rangedAttack(4),
  sidewaysValue: 1,
};
