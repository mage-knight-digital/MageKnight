import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_INFLUENCE, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_WHITE, CARD_HEROIC_TALE } from "@mage-knight/shared";
import { influence } from "../helpers.js";

export const HEROIC_TALE: DeedCard = {
  id: CARD_HEROIC_TALE,
  name: "Heroic Tale",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CATEGORY_INFLUENCE],
  // Basic: Influence 3. Reputation +1 for each Unit you recruit this turn.
  // Powered: Influence 6. Fame +1 and Reputation +1 for each Unit you recruit this turn.
  // TODO: Implement recruitment bonus modifier
  basicEffect: influence(3),
  poweredEffect: influence(6),
  sidewaysValue: 1,
};
