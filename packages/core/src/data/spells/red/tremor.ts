/**
 * Tremor / Earthquake (Red Spell #11)
 * Basic: Target enemy gets Armor -3, OR all enemies get Armor -2.
 * Powered: Target enemy gets Armor -4, OR all enemies get Armor -3.
 */

import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import {
  EFFECT_CHOICE,
  EFFECT_SELECT_COMBAT_ENEMY,
  EFFECT_APPLY_MODIFIER,
} from "../../../types/effectTypes.js";
import { MANA_RED, MANA_BLACK, CARD_TREMOR } from "@mage-knight/shared";
import {
  DURATION_COMBAT,
  EFFECT_ENEMY_STAT,
  ENEMY_STAT_ARMOR,
  SCOPE_ALL_ENEMIES,
} from "../../../types/modifierConstants.js";

export const TREMOR: DeedCard = {
  id: CARD_TREMOR,
  name: "Tremor",
  poweredName: "Earthquake",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_COMBAT],
  poweredBy: [MANA_BLACK, MANA_RED],
  basicEffect: {
    type: EFFECT_CHOICE,
    options: [
      {
        type: EFFECT_SELECT_COMBAT_ENEMY,
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
      {
        type: EFFECT_APPLY_MODIFIER,
        scope: { type: SCOPE_ALL_ENEMIES },
        duration: DURATION_COMBAT,
        modifier: {
          type: EFFECT_ENEMY_STAT,
          stat: ENEMY_STAT_ARMOR,
          amount: -2,
          minimum: 1,
        },
        description: "All enemies get Armor -2",
      },
    ],
  },
  poweredEffect: {
    type: EFFECT_CHOICE,
    options: [
      {
        type: EFFECT_SELECT_COMBAT_ENEMY,
        template: {
          modifiers: [
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
      {
        type: EFFECT_APPLY_MODIFIER,
        scope: { type: SCOPE_ALL_ENEMIES },
        duration: DURATION_COMBAT,
        modifier: {
          type: EFFECT_ENEMY_STAT,
          stat: ENEMY_STAT_ARMOR,
          amount: -3,
          minimum: 1,
        },
        description: "All enemies get Armor -3",
      },
    ],
  },
  sidewaysValue: 1,
};
