import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_RED, CARD_BLOOD_RAGE } from "@mage-knight/shared";
import { attack, choice, compound, takeWound } from "../helpers.js";

export const BLOOD_RAGE: DeedCard = {
  id: CARD_BLOOD_RAGE,
  name: "Blood Rage",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_COMBAT],
  // Basic: Attack 2. You can take a Wound to increase this to Attack 5.
  basicEffect: choice(attack(2), compound(takeWound(1), attack(5))),
  // Powered: Attack 4. You can take a Wound to increase this to Attack 9.
  poweredEffect: choice(attack(4), compound(takeWound(1), attack(9))),
  sidewaysValue: 1,
};
