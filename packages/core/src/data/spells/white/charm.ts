/**
 * Charm / Possess (White Spell #20)
 *
 * Basic (Charm): Influence 4. If used during Interaction, choose one:
 *   gain a crystal of any color OR get a 3 discount towards the cost of one Unit.
 *
 * Powered (Possess): One enemy does not attack. In the Attack phase,
 *   gain Attack equal to its attack value (including elements), but ignore
 *   special abilities (Brutal, Poisonous, Paralyze, etc.).
 *   Gained attack can only target OTHER enemies.
 *   Cannot target Arcane Immune enemies.
 */

import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_INFLUENCE,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import {
  EFFECT_COMPOUND,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_CHOICE,
  EFFECT_CONDITIONAL,
  EFFECT_GAIN_CRYSTAL,
  EFFECT_APPLY_RECRUIT_DISCOUNT,
  EFFECT_POSSESS,
} from "../../../types/effectTypes.js";
import {
  MANA_WHITE,
  MANA_BLACK,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  CARD_CHARM,
} from "@mage-knight/shared";
import { CONDITION_IN_INTERACTION } from "../../../types/conditions.js";

export const CHARM: DeedCard = {
  id: CARD_CHARM,
  name: "Charm",
  poweredName: "Possess",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_INFLUENCE],
  poweredEffectCategories: [CATEGORY_COMBAT],
  poweredBy: [MANA_BLACK, MANA_WHITE],
  basicEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      // Influence 4
      { type: EFFECT_GAIN_INFLUENCE, amount: 4 },
      // If during Interaction: choose crystal or recruit discount
      {
        type: EFFECT_CONDITIONAL,
        condition: { type: CONDITION_IN_INTERACTION },
        thenEffect: {
          type: EFFECT_CHOICE,
          options: [
            // Option 1: Gain a crystal of any color (player picks)
            { type: EFFECT_GAIN_CRYSTAL, color: MANA_RED },
            { type: EFFECT_GAIN_CRYSTAL, color: MANA_BLUE },
            { type: EFFECT_GAIN_CRYSTAL, color: MANA_GREEN },
            { type: EFFECT_GAIN_CRYSTAL, color: MANA_WHITE },
            // Option 2: Recruit discount of 3 (no reputation penalty)
            { type: EFFECT_APPLY_RECRUIT_DISCOUNT, discount: 3, reputationChange: 0 },
          ],
        },
      },
    ],
  },
  poweredEffect: {
    type: EFFECT_POSSESS,
  },
  sidewaysValue: 1,
};
