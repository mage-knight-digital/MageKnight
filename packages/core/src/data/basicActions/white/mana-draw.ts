import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_SPECIAL, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { MANA_WHITE, CARD_MANA_DRAW } from "@mage-knight/shared";
import { grantExtraSourceDie, manaDrawPowered } from "../helpers.js";

export const MANA_DRAW: DeedCard = {
  id: CARD_MANA_DRAW,
  name: "Mana Draw",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CATEGORY_SPECIAL],
  // Basic: Use 1 additional mana die from Source this turn
  basicEffect: grantExtraSourceDie(),
  // Powered: Take a die, set to any basic color, gain 2 mana tokens of that color
  // Die is returned at end of turn WITHOUT rerolling (keeps chosen color)
  poweredEffect: manaDrawPowered(),
  sidewaysValue: 1,
};
