import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_MOVEMENT,
  CATEGORY_INFLUENCE,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../../types/cards.js";
import { MANA_GREEN, CARD_STOUT_RESOLVE } from "@mage-knight/shared";
import { attack, block, move, influence, choice } from "../helpers.js";

export const STOUT_RESOLVE: DeedCard = {
  id: CARD_STOUT_RESOLVE,
  name: "Stout Resolve",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_GREEN],
  categories: [CATEGORY_MOVEMENT, CATEGORY_INFLUENCE, CATEGORY_COMBAT],
  // Basic: Move 2, Influence 2, Attack 2 or Block 2. You may discard a Wound to increase the effect by 1.
  // Powered: Move 3, Influence 3, Attack 3 or Block 3. You may discard any number of cards, including one Wound, to increase the effect by 2 for each.
  // TODO: Implement wound-discard bonus
  basicEffect: choice(move(2), influence(2), attack(2), block(2)),
  poweredEffect: choice(move(3), influence(3), attack(3), block(3)),
  sidewaysValue: 1,
};
