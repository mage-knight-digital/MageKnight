import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_INFLUENCE,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../../types/cards.js";
import { MANA_WHITE, CARD_DIPLOMACY } from "@mage-knight/shared";
import { influence } from "../helpers.js";

export const DIPLOMACY: DeedCard = {
  id: CARD_DIPLOMACY,
  name: "Diplomacy",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CATEGORY_INFLUENCE, CATEGORY_COMBAT],
  // Basic: Influence 2. You may use Influence as Block this turn.
  // Powered: Influence 4. Choose Ice or Fire. You may use Influence as Block of the chosen element this turn.
  // TODO: Implement influence-as-block modifier
  basicEffect: influence(2),
  poweredEffect: influence(4),
  sidewaysValue: 1,
};
