import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import {
  COMBAT_TYPE_SIEGE,
  CARD_COLOR_RED,
  CARD_COLOR_BLUE,
  CARD_COLOR_GREEN,
  CARD_COLOR_WHITE,
} from "../../../types/effectTypes.js";
import { MANA_RED, CARD_RITUAL_ATTACK } from "@mage-knight/shared";
import {
  attack,
  attackWithElement,
  rangedAttack,
  rangedAttackWithElement,
  siegeAttack,
  discardCostByColor,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_COLD_FIRE,
} from "../helpers.js";

export const RITUAL_ATTACK: DeedCard = {
  id: CARD_RITUAL_ATTACK,
  name: "Ritual Attack",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_COMBAT],
  // Basic: Throw away another Action card. Depending on its color, you get: Attack 5 for red, Ice Attack 3 for blue, Ranged Attack 3 for white, Siege Attack 2 for green.
  // Powered: Throw away another Action card. Depending on its color, you get: Fire Attack 6 for red, Cold Fire Attack 4 for blue, Ranged Fire Attack 4 for white, Siege Fire Attack 3 for green.
  basicEffect: discardCostByColor(1, {
    [CARD_COLOR_RED]: attack(5),
    [CARD_COLOR_BLUE]: attackWithElement(3, ELEMENT_ICE),
    [CARD_COLOR_WHITE]: rangedAttack(3),
    [CARD_COLOR_GREEN]: siegeAttack(2),
  }),
  poweredEffect: discardCostByColor(1, {
    [CARD_COLOR_RED]: attackWithElement(6, ELEMENT_FIRE),
    [CARD_COLOR_BLUE]: attackWithElement(4, ELEMENT_COLD_FIRE),
    [CARD_COLOR_WHITE]: rangedAttackWithElement(4, ELEMENT_FIRE),
    [CARD_COLOR_GREEN]: attackWithElement(3, ELEMENT_FIRE, COMBAT_TYPE_SIEGE),
  }),
  sidewaysValue: 1,
};
