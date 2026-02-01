import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_RED, CARD_BLOOD_RAGE } from "@mage-knight/shared";
import { attack } from "../helpers.js";

export const BLOOD_RAGE: DeedCard = {
  id: CARD_BLOOD_RAGE,
  name: "Blood Rage",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_COMBAT],
  // Basic: Attack 2. You can take a Wound to increase this to Attack 5.
  // Powered: Attack 4. You can take a Wound to increase this to Attack 9.
  // TODO: Implement wound-for-bonus mechanic
  basicEffect: attack(2),
  poweredEffect: attack(4),
  sidewaysValue: 1,
};
