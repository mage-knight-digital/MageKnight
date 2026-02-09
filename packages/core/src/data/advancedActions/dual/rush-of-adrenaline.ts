import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_SPECIAL, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_GREEN, MANA_RED, CARD_RUSH_OF_ADRENALINE } from "@mage-knight/shared";
import { EFFECT_RUSH_OF_ADRENALINE } from "../../../types/effectTypes.js";

export const RUSH_OF_ADRENALINE: DeedCard = {
  id: CARD_RUSH_OF_ADRENALINE,
  name: "Rush of Adrenaline",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_GREEN, MANA_RED], // Can be powered by green OR red
  categories: [CATEGORY_SPECIAL],
  // Basic: For each of the first three Wounds you take to your hand this turn, draw a card.
  basicEffect: {
    type: EFFECT_RUSH_OF_ADRENALINE,
    mode: "basic",
  },
  // Powered: After taking the first Wound to your hand this turn, throw it away and draw a card.
  // For each of the next three Wounds you take, draw a card.
  poweredEffect: {
    type: EFFECT_RUSH_OF_ADRENALINE,
    mode: "powered",
  },
  sidewaysValue: 1,
};
