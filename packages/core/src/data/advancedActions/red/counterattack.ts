import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_RED, CARD_COUNTERATTACK } from "@mage-knight/shared";
import { attackPerEnemyBlocked } from "../../effectHelpers.js";

export const COUNTERATTACK: DeedCard = {
  id: CARD_COUNTERATTACK,
  name: "Counterattack",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_COMBAT],
  // Basic: Attack 2. Get an additional Attack 2 for each enemy blocked this turn.
  basicEffect: attackPerEnemyBlocked(2, 2),
  // Powered: Attack 4. Get an additional Attack 3 for each enemy blocked this turn.
  poweredEffect: attackPerEnemyBlocked(4, 3),
  sidewaysValue: 1,
};
