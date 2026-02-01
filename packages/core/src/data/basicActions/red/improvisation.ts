import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_MOVEMENT,
  CATEGORY_COMBAT,
  CATEGORY_INFLUENCE,
  DEED_CARD_TYPE_BASIC_ACTION,
} from "../../../types/cards.js";
import { MANA_RED, CARD_IMPROVISATION } from "@mage-knight/shared";
import { move, influence, attack, block, choice } from "../helpers.js";

export const IMPROVISATION: DeedCard = {
  id: CARD_IMPROVISATION,
  name: "Improvisation",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_MOVEMENT, CATEGORY_COMBAT, CATEGORY_INFLUENCE],
  // Basic: Discard a card → Move 3, Influence 3, Attack 3, or Block 3
  // Powered: Discard a card → Move 5, Influence 5, Attack 5, or Block 5
  // Note: Discard cost not modeled
  basicEffect: choice(move(3), influence(3), attack(3), block(3)),
  poweredEffect: choice(move(5), influence(5), attack(5), block(5)),
  sidewaysValue: 1,
};
