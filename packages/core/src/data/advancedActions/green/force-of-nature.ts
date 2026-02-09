import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_GREEN, CARD_FORCE_OF_NATURE, RESIST_PHYSICAL } from "@mage-knight/shared";
import { block, siegeAttack, choice } from "../helpers.js";
import { EFFECT_SELECT_UNIT_FOR_MODIFIER } from "../../../types/effectTypes.js";
import {
  DURATION_COMBAT,
  EFFECT_GRANT_RESISTANCES,
} from "../../../types/modifierConstants.js";

export const FORCE_OF_NATURE: DeedCard = {
  id: CARD_FORCE_OF_NATURE,
  name: "Force of Nature",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_GREEN],
  categories: [CATEGORY_COMBAT],
  // Basic: Chosen Unit gains Physical resistance this combat.
  // Powered: Siege Attack 3 or Block 6
  basicEffect: {
    type: EFFECT_SELECT_UNIT_FOR_MODIFIER,
    modifier: {
      type: EFFECT_GRANT_RESISTANCES,
      resistances: [RESIST_PHYSICAL],
    },
    duration: DURATION_COMBAT,
    description: "Chosen unit gains Physical Resistance",
  },
  poweredEffect: choice(siegeAttack(3), block(6)),
  sidewaysValue: 1,
};
