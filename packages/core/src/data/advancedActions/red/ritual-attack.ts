import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_RED, CARD_RITUAL_ATTACK } from "@mage-knight/shared";
import { attack, attackWithElement, ELEMENT_FIRE } from "../helpers.js";

export const RITUAL_ATTACK: DeedCard = {
  id: CARD_RITUAL_ATTACK,
  name: "Ritual Attack",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_COMBAT],
  // Basic: Throw away another Action card. Depending on its color, you get: Attack 5 for red, Ice Attack 3 for blue, Ranged Attack 3 for white, Siege Attack 2 for green.
  // Powered: Throw away another Action card. Depending on its color, you get: Fire Attack 6 for red, Cold Fire Attack 4 for blue, Ranged Fire Attack 4 for white, Siege Fire Attack 3 for green.
  // TODO: Implement throw-away mechanic with color-dependent attack
  basicEffect: attack(5),
  poweredEffect: attackWithElement(6, ELEMENT_FIRE),
  sidewaysValue: 1,
};
