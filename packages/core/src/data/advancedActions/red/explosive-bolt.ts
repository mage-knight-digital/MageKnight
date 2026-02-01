import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../../types/cards.js";
import { MANA_RED, MANA_WHITE, CARD_EXPLOSIVE_BOLT } from "@mage-knight/shared";
import { gainCrystal, rangedAttack } from "../helpers.js";

export const EXPLOSIVE_BOLT: DeedCard = {
  id: CARD_EXPLOSIVE_BOLT,
  name: "Explosive Bolt",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_RED, MANA_WHITE], // Dual-color: can be powered by red OR white
  categories: [CATEGORY_SPECIAL, CATEGORY_COMBAT],
  // Basic: Take a Wound. Gain a white and a red crystal to your Inventory.
  // Powered: Ranged Attack 3. For each enemy defeated by this attack, another enemy gets Armor -1 (to a minimum of 1).
  // TODO: Implement wound-taking, dual crystal gain, and armor reduction on defeat
  basicEffect: gainCrystal(MANA_RED),
  poweredEffect: rangedAttack(3),
  sidewaysValue: 1,
};
