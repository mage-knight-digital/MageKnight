import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_RED, CARD_COUNTERATTACK } from "@mage-knight/shared";
import { attack } from "../helpers.js";

export const COUNTERATTACK: DeedCard = {
  id: CARD_COUNTERATTACK,
  name: "Counterattack",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_COMBAT],
  // Basic: Attack 2. Get an additional Attack 2 for each enemy blocked this turn.
  // Powered: Attack 4. Get an additional Attack 3 for each enemy blocked this turn.
  // TODO: Implement scaling based on blocked enemies
  basicEffect: attack(2),
  poweredEffect: attack(4),
  sidewaysValue: 1,
};
