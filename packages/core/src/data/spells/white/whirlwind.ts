/**
 * Whirlwind / Tornado (White Spell #22)
 * Basic: Target enemy does not attack.
 * Powered (Tornado): Defeat target enemy. Can only be played in Attack phase.
 */

import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import { EFFECT_SELECT_COMBAT_ENEMY } from "../../../types/effectTypes.js";
import { MANA_WHITE, MANA_BLACK, CARD_WHIRLWIND } from "@mage-knight/shared";
import {
  DURATION_COMBAT,
  EFFECT_ENEMY_SKIP_ATTACK,
} from "../../../types/modifierConstants.js";
import { COMBAT_PHASE_ATTACK } from "../../../types/combat.js";

export const WHIRLWIND: DeedCard = {
  id: CARD_WHIRLWIND,
  name: "Whirlwind",
  poweredName: "Tornado",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_COMBAT],
  poweredBy: [MANA_BLACK, MANA_WHITE],
  basicEffect: {
    type: EFFECT_SELECT_COMBAT_ENEMY,
    template: {
      modifiers: [
        {
          modifier: { type: EFFECT_ENEMY_SKIP_ATTACK },
          duration: DURATION_COMBAT,
          description: "Target enemy does not attack",
        },
      ],
    },
  },
  poweredEffect: {
    type: EFFECT_SELECT_COMBAT_ENEMY,
    template: { defeat: true },
    requiredPhase: COMBAT_PHASE_ATTACK,
  },
  sidewaysValue: 1,
};
