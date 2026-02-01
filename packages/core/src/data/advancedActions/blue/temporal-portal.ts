import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_SPECIAL, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_BLUE, CARD_TEMPORAL_PORTAL } from "@mage-knight/shared";
import { move } from "../helpers.js";

export const TEMPORAL_PORTAL: DeedCard = {
  id: CARD_TEMPORAL_PORTAL,
  name: "Temporal Portal",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_SPECIAL],
  // Basic: Play as your action for this turn. You may move to an adjacent revealed safe space (without provoking rampaging monsters). Whether you move or not, your Hand limit is higher by 1 the next time you draw cards.
  // Powered: As above, except you can either move two spaces to a revealed safe space instead of one, or get your Hand limit increased by 2 instead of 1.
  // TODO: Implement teleport and hand limit modifier
  basicEffect: move(1),
  poweredEffect: move(2),
  sidewaysValue: 1,
};
