import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_MOVEMENT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_GREEN, CARD_PATH_FINDING } from "@mage-knight/shared";
import { move } from "../helpers.js";

export const PATH_FINDING: DeedCard = {
  id: CARD_PATH_FINDING,
  name: "Path Finding",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_GREEN],
  categories: [CATEGORY_MOVEMENT],
  // Basic: Move 2. The Move cost of all terrains is reduced by 1, to a minimum of 2, this turn.
  // Powered: Move 4. The Move cost of all terrains is reduced to 2 this turn.
  // TODO: Implement terrain cost modifier
  basicEffect: move(2),
  poweredEffect: move(4),
  sidewaysValue: 1,
};
