import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_MOVEMENT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_BLUE, CARD_STEADY_TEMPO } from "@mage-knight/shared";
import { move } from "../helpers.js";

export const STEADY_TEMPO: DeedCard = {
  id: CARD_STEADY_TEMPO,
  name: "Steady Tempo",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_MOVEMENT],
  // Basic: Move 2. Deck placement on bottom (requires non-empty deck) handled by playCardCommand + endTurn flow.
  // Powered: Move 4. Deck placement on top handled by playCardCommand + endTurn flow.
  basicEffect: move(2),
  poweredEffect: move(4),
  sidewaysValue: 1,
};
