import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_SPECIAL, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_RED, CARD_BLOOD_OF_ANCIENTS } from "@mage-knight/shared";
import { influence } from "../helpers.js";

export const BLOOD_OF_ANCIENTS: DeedCard = {
  id: CARD_BLOOD_OF_ANCIENTS,
  name: "Blood of Ancients",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_SPECIAL],
  // Basic: Gain a Wound. Pay one mana of any color. Gain a card of that color from the Advanced Actions offer and put it into your hand.
  // Powered: Gain a Wound to your hand or discard pile. Use the stronger effect of any card from the Advanced Actions offer without paying its mana cost. The card remains in the offer.
  // TODO: Implement wound-taking, mana payment, and advanced action acquisition
  basicEffect: influence(3),
  poweredEffect: influence(6),
  sidewaysValue: 1,
};
