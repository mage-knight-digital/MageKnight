/**
 * Cure / Disease (White Spell)
 *
 * Basic (Cure): Heal 2 wounds from hand, draw a card for each wound healed
 *   from hand this turn, ready all units healed this turn. Future healing
 *   this turn also triggers card draws and unit readying.
 *
 * Powered (Disease): All enemies with ALL attacks blocked get armor reduced to 1.
 */

import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_HEALING,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import { EFFECT_CURE, EFFECT_DISEASE } from "../../../types/effectTypes.js";
import { MANA_WHITE, MANA_BLACK, CARD_CURE } from "@mage-knight/shared";

export const CURE: DeedCard = {
  id: CARD_CURE,
  name: "Cure",
  poweredName: "Disease",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_HEALING],
  poweredEffectCategories: [CATEGORY_COMBAT],
  poweredBy: [MANA_BLACK, MANA_WHITE],
  basicEffect: {
    type: EFFECT_CURE,
    amount: 2,
  },
  poweredEffect: {
    type: EFFECT_DISEASE,
  },
  sidewaysValue: 1,
};
