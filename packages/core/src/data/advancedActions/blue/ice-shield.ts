import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_BLUE, CARD_ICE_SHIELD } from "@mage-knight/shared";
import { blockWithElement, ELEMENT_ICE } from "../helpers.js";

export const ICE_SHIELD: DeedCard = {
  id: CARD_ICE_SHIELD,
  name: "Ice Shield",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_COMBAT],
  // Basic: Ice Block 3
  // Powered: Ice Block 3. Reduce the Armor of one enemy blocked this way by 3. Armor cannot be reduced below 1.
  // TODO: Implement armor reduction on block
  basicEffect: blockWithElement(3, ELEMENT_ICE),
  poweredEffect: blockWithElement(3, ELEMENT_ICE),
  sidewaysValue: 1,
};
