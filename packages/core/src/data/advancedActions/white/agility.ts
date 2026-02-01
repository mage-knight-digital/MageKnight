import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_WHITE, CARD_AGILITY } from "@mage-knight/shared";
import { move } from "../helpers.js";

export const AGILITY: DeedCard = {
  id: CARD_AGILITY,
  name: "Agility",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CATEGORY_COMBAT],
  // Basic: Move 2. During combat this turn, you may spend Move points to get Attack 1 for each.
  // Powered: Move 4. During combat this turn you may spend any amount of Move points: 1 to get Attack 1 and/or 2 to get Ranged Attack 1.
  // TODO: Implement move-to-attack conversion modifier
  basicEffect: move(2),
  poweredEffect: move(4),
  sidewaysValue: 1,
};
