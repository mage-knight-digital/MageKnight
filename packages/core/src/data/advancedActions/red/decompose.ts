import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_SPECIAL, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_RED, CARD_DECOMPOSE } from "@mage-knight/shared";
import { gainCrystal } from "../helpers.js";

export const DECOMPOSE: DeedCard = {
  id: CARD_DECOMPOSE,
  name: "Decompose",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_SPECIAL],
  // Basic: When you play this card, throw away an Action card from hand. Gain two crystals to your Inventory that are the same color as the thrown away card.
  // Powered: When you play this card, throw away an Action card from hand. Gain a crystal to your Inventory of each basic color that does not match the color of the thrown away card.
  // TODO: Implement throw-away mechanic and crystal generation based on discarded card
  basicEffect: gainCrystal(MANA_RED),
  poweredEffect: gainCrystal(MANA_RED),
  sidewaysValue: 1,
};
