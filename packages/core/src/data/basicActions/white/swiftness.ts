import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_MOVEMENT, CATEGORY_COMBAT, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { COMBAT_TYPE_RANGED } from "../../../types/effectTypes.js";
import { MANA_WHITE, CARD_SWIFTNESS } from "@mage-knight/shared";
import { move, attack } from "../helpers.js";

export const SWIFTNESS: DeedCard = {
  id: CARD_SWIFTNESS,
  name: "Swiftness",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CATEGORY_MOVEMENT, CATEGORY_COMBAT],
  // Basic: Move 2 | Powered: Ranged Attack 3
  basicEffect: move(2),
  poweredEffect: attack(3, COMBAT_TYPE_RANGED),
  sidewaysValue: 1,
};
