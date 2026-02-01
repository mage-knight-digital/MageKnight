import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_MOVEMENT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_GREEN, CARD_MOUNTAIN_LORE } from "@mage-knight/shared";
import { move } from "../helpers.js";

export const MOUNTAIN_LORE: DeedCard = {
  id: CARD_MOUNTAIN_LORE,
  name: "Mountain Lore",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_GREEN],
  categories: [CATEGORY_MOVEMENT],
  // Basic: Move 3. If you end your turn in hills, your Hand limit is higher by 1 the next time you draw cards.
  // Powered: Move 5. You can enter mountains at a Move cost of 5 and they are considered a safe space for you at the end of this turn. If you end your turn in mountains/hills, your Hand limit is higher by 2/1 the next time you draw cards.
  // TODO: Implement terrain-based hand limit modifier
  basicEffect: move(3),
  poweredEffect: move(5),
  sidewaysValue: 1,
};
