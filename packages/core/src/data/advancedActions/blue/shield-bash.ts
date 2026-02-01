import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_BLUE, CARD_SHIELD_BASH } from "@mage-knight/shared";
import { block } from "../helpers.js";

export const SHIELD_BASH: DeedCard = {
  id: CARD_SHIELD_BASH,
  name: "Shield Bash",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_COMBAT],
  // Basic: Block 3. Counts twice against an attack with Swiftness.
  // Powered: Block 5. Counts twice against an attack with Swiftness. Blocked enemy gets Armor -1 for each point of block higher than needed (to a minimum of 1).
  // TODO: Implement swiftness counter and armor reduction
  basicEffect: block(3),
  poweredEffect: block(5),
  sidewaysValue: 1,
};
