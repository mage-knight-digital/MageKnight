import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_BLUE, MANA_WHITE, CARD_CHILLING_STARE } from "@mage-knight/shared";
import { block, influence, choice } from "../helpers.js";

export const CHILLING_STARE: DeedCard = {
  id: CARD_CHILLING_STARE,
  name: "Chilling Stare",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_BLUE, MANA_WHITE], // Can be powered by blue OR white
  categories: [CATEGORY_COMBAT],
  // Basic: Influence 3, or a chosen enemy attack loses all attack abilities (but not its color).
  // Powered: Influence 5, or a chosen enemy does not attack this turn.
  // TODO: Implement enemy attack cancellation
  basicEffect: choice(influence(3), block(3)),
  poweredEffect: choice(influence(5), block(5)),
  sidewaysValue: 1,
};
