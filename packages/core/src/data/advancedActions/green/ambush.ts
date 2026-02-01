import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_MOVEMENT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_GREEN, CARD_AMBUSH } from "@mage-knight/shared";
import { move } from "../helpers.js";

export const AMBUSH: DeedCard = {
  id: CARD_AMBUSH,
  name: "Ambush",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_GREEN],
  categories: [CATEGORY_MOVEMENT],
  // Basic: Move 2. Add +1 to your first Attack card of any type or +2 to your first Block card of any type, whichever you play first this turn.
  // Powered: Move 4. Add +2 to your first Attack card of any type or +4 to your first Block card of any type, whichever you play first this turn.
  // TODO: Implement first-card bonus modifier
  basicEffect: move(2),
  poweredEffect: move(4),
  sidewaysValue: 1,
};
