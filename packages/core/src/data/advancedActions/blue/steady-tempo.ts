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
  // Basic: Move 2. At the end of your turn, instead of putting this card in your discard pile, you may place it on the bottom of your Deed deck as long as it is not empty.
  // Powered: Move 4. At the end of your turn, instead of putting this card in your discard pile, you may place it on top of your Deed deck.
  // TODO: Implement deck placement modifier
  basicEffect: move(2),
  poweredEffect: move(4),
  sidewaysValue: 1,
};
