import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../../types/cards.js";
import { MANA_RED, MANA_WHITE, CARD_EXPLOSIVE_BOLT } from "@mage-knight/shared";
import {
  compound,
  takeWound,
  gainCrystal,
  rangedAttackWithArmorReduction,
} from "../helpers.js";

export const EXPLOSIVE_BOLT: DeedCard = {
  id: CARD_EXPLOSIVE_BOLT,
  name: "Explosive Bolt",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_RED, MANA_WHITE], // Dual-color: can be powered by red OR white
  categories: [CATEGORY_SPECIAL, CATEGORY_COMBAT],
  // Basic: Take a Wound. Gain a white and a red crystal to your Inventory.
  basicEffect: compound(
    takeWound(1),
    gainCrystal(MANA_WHITE),
    gainCrystal(MANA_RED),
  ),
  // Powered: Ranged Attack 3. For each enemy defeated by this attack, another enemy gets Armor -1 (min 1).
  poweredEffect: rangedAttackWithArmorReduction(3, 1),
  sidewaysValue: 1,
};
