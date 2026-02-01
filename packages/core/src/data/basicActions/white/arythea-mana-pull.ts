import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_SPECIAL, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { MANA_WHITE, CARD_ARYTHEA_MANA_PULL } from "@mage-knight/shared";
import { grantExtraSourceDieWithBlackAsAnyColor, manaPullPowered } from "../helpers.js";

/**
 * Arythea's Mana Pull (replaces Mana Draw)
 */
export const ARYTHEA_MANA_PULL: DeedCard = {
  id: CARD_ARYTHEA_MANA_PULL,
  name: "Mana Pull",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CATEGORY_SPECIAL],
  // Basic: Use 1 additional die from Source; if black, use as any color
  basicEffect: grantExtraSourceDieWithBlackAsAnyColor(),
  // Powered: Take 2 dice, set each to any non-gold color, gain 1 mana token of each
  // Dice don't reroll when returned
  poweredEffect: manaPullPowered(),
  sidewaysValue: 1,
};
