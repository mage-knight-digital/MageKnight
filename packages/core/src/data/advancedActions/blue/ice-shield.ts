import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import {
  EFFECT_SELECT_COMBAT_ENEMY,
} from "../../../types/effectTypes.js";
import { MANA_BLUE, CARD_ICE_SHIELD, RESIST_ICE } from "@mage-knight/shared";
import {
  DURATION_COMBAT,
  EFFECT_ENEMY_STAT,
  ENEMY_STAT_ARMOR,
} from "../../../types/modifierConstants.js";
import { blockWithElement, compound, ELEMENT_ICE } from "../helpers.js";

export const ICE_SHIELD: DeedCard = {
  id: CARD_ICE_SHIELD,
  name: "Ice Shield",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_COMBAT],
  // Basic: Ice Block 3
  basicEffect: blockWithElement(3, ELEMENT_ICE),
  // Powered: Ice Block 3 + reduce one non-ice-resistant enemy's Armor by 3 (min 1)
  poweredEffect: compound(
    blockWithElement(3, ELEMENT_ICE),
    {
      type: EFFECT_SELECT_COMBAT_ENEMY,
      excludeResistance: RESIST_ICE,
      template: {
        modifiers: [
          {
            modifier: {
              type: EFFECT_ENEMY_STAT,
              stat: ENEMY_STAT_ARMOR,
              amount: -3,
              minimum: 1,
            },
            duration: DURATION_COMBAT,
            description: "Target enemy gets Armor -3",
          },
        ],
      },
    },
  ),
  sidewaysValue: 1,
};
