/**
 * Red spell card definitions
 *
 * Red spells are powered by BLACK + RED mana.
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../types/cards.js";
import {
  EFFECT_COMPOUND,
  EFFECT_TAKE_WOUND,
  EFFECT_CHOICE,
  EFFECT_SELECT_COMBAT_ENEMY,
  EFFECT_APPLY_MODIFIER,
} from "../../types/effectTypes.js";
import {
  MANA_RED,
  MANA_BLACK,
  CARD_FIREBALL,
  CARD_FLAME_WALL,
  CARD_TREMOR,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import {
  DURATION_COMBAT,
  EFFECT_ENEMY_STAT,
  ENEMY_STAT_ARMOR,
  SCOPE_ALL_ENEMIES,
} from "../../types/modifierConstants.js";
import {
  fireRangedAttack,
  fireSiegeAttack,
  fireAttack,
  fireBlock,
  choice,
} from "./helpers.js";

/**
 * Fireball (Red Spell #09)
 * Basic: Ranged Fire Attack 5
 * Powered: Take a Wound. Siege Fire Attack 8.
 */
const FIREBALL: DeedCard = {
  id: CARD_FIREBALL,
  name: "Fireball",
  poweredName: "Firestorm",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_COMBAT],
  poweredBy: [MANA_BLACK, MANA_RED],
  basicEffect: fireRangedAttack(5),
  poweredEffect: {
    type: EFFECT_COMPOUND,
    effects: [{ type: EFFECT_TAKE_WOUND, amount: 1 }, fireSiegeAttack(8)],
  },
  sidewaysValue: 1,
};

/**
 * Flame Wall / Flame Wave (Red Spell #10)
 * Basic (Flame Wall): Fire Attack 5, or Fire Block 7
 * Powered (Flame Wave): Same choice, +2 per enemy
 *
 * Note: The scaling powered effect is not yet implemented.
 * For now, powered just gives the base values.
 */
const FLAME_WALL: DeedCard = {
  id: CARD_FLAME_WALL,
  name: "Flame Wall",
  poweredName: "Flame Wave",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_COMBAT],
  poweredBy: [MANA_BLACK, MANA_RED],
  basicEffect: choice([fireAttack(5), fireBlock(7)]),
  poweredEffect: choice([fireAttack(5), fireBlock(7)]), // TODO: Add scaling
  sidewaysValue: 1,
};

/**
 * Tremor / Earthquake (Red Spell #11)
 * Basic: Target enemy gets Armor -3, OR all enemies get Armor -2.
 * Powered: Target enemy gets Armor -4, OR all enemies get Armor -3.
 */
const TREMOR: DeedCard = {
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

export const RED_SPELLS: Record<CardId, DeedCard> = {
  [CARD_FIREBALL]: FIREBALL,
  [CARD_FLAME_WALL]: FLAME_WALL,
  [CARD_TREMOR]: TREMOR,
};
