import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_WHITE, CARD_CHIVALRY } from "@mage-knight/shared";
import { attack, choice, attackWithDefeatBonus } from "../helpers.js";

export const CHIVALRY: DeedCard = {
  id: CARD_CHIVALRY,
  name: "Chivalry",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CATEGORY_COMBAT],
  // Basic: Attack 3, or Attack 2 and Reputation +1 for each enemy defeated by this attack.
  basicEffect: choice(attack(3), attackWithDefeatBonus(2, { reputation: 1 })),
  // Powered: Attack 6, or Attack 4 and Reputation +1 and Fame +1 for each enemy defeated by this attack.
  poweredEffect: choice(attack(6), attackWithDefeatBonus(4, { reputation: 1, fame: 1 })),
  sidewaysValue: 1,
};
