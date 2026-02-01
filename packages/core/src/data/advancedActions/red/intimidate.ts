import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_INFLUENCE,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../../types/cards.js";
import { MANA_RED, CARD_INTIMIDATE } from "@mage-knight/shared";
import { attack, influence, choice, compound, changeReputation } from "../helpers.js";

export const INTIMIDATE: DeedCard = {
  id: CARD_INTIMIDATE,
  name: "Intimidate",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_INFLUENCE, CATEGORY_COMBAT],
  // Basic: Influence 4 or Attack 3. Reputation -1.
  // Powered: Influence 8 or Attack 7. Reputation -2.
  basicEffect: compound(choice(influence(4), attack(3)), changeReputation(-1)),
  poweredEffect: compound(choice(influence(8), attack(7)), changeReputation(-2)),
  sidewaysValue: 1,
};
