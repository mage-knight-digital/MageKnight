/**
 * Chill / Lethal Chill (Blue Spell #13)
 * Basic: Target enemy does not attack this combat. If it has Fire Resistance, it loses it.
 * Powered (Lethal Chill): Target enemy does not attack and gets Armor -4.
 *
 * Note: Fire Resistance removal not yet implemented.
 */

import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import { EFFECT_SELECT_COMBAT_ENEMY } from "../../../types/effectTypes.js";
import { MANA_BLUE, MANA_BLACK, CARD_CHILL } from "@mage-knight/shared";
import {
  DURATION_COMBAT,
  EFFECT_ENEMY_STAT,
  EFFECT_ENEMY_SKIP_ATTACK,
  ENEMY_STAT_ARMOR,
} from "../../../types/modifierConstants.js";

export const CHILL: DeedCard = {
  id: CARD_CHILL,
  name: "Chill",
  poweredName: "Lethal Chill",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_COMBAT],
  poweredBy: [MANA_BLACK, MANA_BLUE],
  basicEffect: {
    type: EFFECT_SELECT_COMBAT_ENEMY,
    template: {
      modifiers: [
        {
          modifier: { type: EFFECT_ENEMY_SKIP_ATTACK },
          duration: DURATION_COMBAT,
          description: "Target enemy does not attack",
        },
        // TODO: Add fire resistance removal
      ],
    },
  },
  poweredEffect: {
    type: EFFECT_SELECT_COMBAT_ENEMY,
    template: {
      modifiers: [
        {
          modifier: { type: EFFECT_ENEMY_SKIP_ATTACK },
          duration: DURATION_COMBAT,
          description: "Target enemy does not attack",
        },
        {
          modifier: {
            type: EFFECT_ENEMY_STAT,
            stat: ENEMY_STAT_ARMOR,
            amount: -4,
            minimum: 1,
          },
          duration: DURATION_COMBAT,
          description: "Target enemy gets Armor -4",
        },
      ],
    },
  },
  sidewaysValue: 1,
};
