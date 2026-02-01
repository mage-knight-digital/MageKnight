import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_RED, CARD_INTO_THE_HEAT } from "@mage-knight/shared";
import { attack } from "../helpers.js";

export const INTO_THE_HEAT: DeedCard = {
  id: CARD_INTO_THE_HEAT,
  name: "Into the Heat",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_COMBAT],
  // Basic: Play this card at the start of combat. All of your Units get their Attack and Block values increased by 2 this combat. You cannot assign damage to your Units this turn.
  // Powered: Play this card at the start of combat. All of your Units get their Attack and Block values increased by 3 this combat. You cannot assign damage to your Units this turn.
  // TODO: Implement unit buff modifier and damage assignment restriction
  basicEffect: attack(2),
  poweredEffect: attack(3),
  sidewaysValue: 1,
};
