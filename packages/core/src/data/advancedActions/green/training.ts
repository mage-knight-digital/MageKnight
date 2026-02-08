import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_SPECIAL, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_GREEN, CARD_TRAINING } from "@mage-knight/shared";
import { EFFECT_TRAINING } from "../../../types/effectTypes.js";

export const TRAINING: DeedCard = {
  id: CARD_TRAINING,
  name: "Training",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_GREEN],
  categories: [CATEGORY_SPECIAL],
  // Basic: Throw away an Action card from your hand, then take a card of the same color
  //        from the Advanced Actions offer and put it into your discard pile.
  basicEffect: { type: EFFECT_TRAINING, mode: "basic" },
  // Powered: Throw away an Action card from your hand, then take a card of the same color
  //          from the Advanced Actions offer and put it into your hand.
  poweredEffect: { type: EFFECT_TRAINING, mode: "powered" },
  sidewaysValue: 1,
};
