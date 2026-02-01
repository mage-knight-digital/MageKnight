import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_GREEN, CARD_FORCE_OF_NATURE } from "@mage-knight/shared";
import { block, siegeAttack, choice } from "../helpers.js";

export const FORCE_OF_NATURE: DeedCard = {
  id: CARD_FORCE_OF_NATURE,
  name: "Force of Nature",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_GREEN],
  categories: [CATEGORY_COMBAT],
  // Basic: Chosen Unit gains Physical resistance this combat.
  // Powered: Siege Attack 3 or Block 6
  // TODO: Implement unit resistance modifier
  basicEffect: block(2),
  poweredEffect: choice(siegeAttack(3), block(6)),
  sidewaysValue: 1,
};
