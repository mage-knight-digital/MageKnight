import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_INFLUENCE,
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../../types/cards.js";
import { MANA_WHITE, CARD_LEARNING } from "@mage-knight/shared";
import { influence, compound } from "../helpers.js";
import { EFFECT_APPLY_LEARNING_DISCOUNT } from "../../../types/effectTypes.js";

export const LEARNING: DeedCard = {
  id: CARD_LEARNING,
  name: "Learning",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CATEGORY_INFLUENCE, CATEGORY_SPECIAL],
  // Basic: Influence 2. Once during this turn, you may pay Influence 6 to gain an Advanced Action card from the Advanced Actions offer to your discard pile.
  // Powered: Influence 4. Once during this turn, you may pay Influence 9 to gain an Advanced Action card from the Advanced Actions offer to your hand.
  basicEffect: compound(
    influence(2),
    { type: EFFECT_APPLY_LEARNING_DISCOUNT, cost: 6, destination: "discard" },
  ),
  poweredEffect: compound(
    influence(4),
    { type: EFFECT_APPLY_LEARNING_DISCOUNT, cost: 9, destination: "hand" },
  ),
  sidewaysValue: 1,
};
