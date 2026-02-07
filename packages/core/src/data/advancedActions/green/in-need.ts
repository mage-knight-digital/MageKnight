import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_INFLUENCE, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_GREEN, CARD_IN_NEED } from "@mage-knight/shared";
import { influencePerWoundTotal } from "../../effectHelpers.js";

export const IN_NEED: DeedCard = {
  id: CARD_IN_NEED,
  name: "In Need",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_GREEN],
  categories: [CATEGORY_INFLUENCE],
  // Basic: Influence 3. Get an additional Influence 1 for each Wound card in your hand and on Units you control.
  // Powered: Influence 5. Get an additional Influence 2 for each Wound card in your hand and on Units you control.
  basicEffect: influencePerWoundTotal(3, 1),
  poweredEffect: influencePerWoundTotal(5, 2),
  sidewaysValue: 1,
};
