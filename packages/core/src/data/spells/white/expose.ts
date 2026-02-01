/**
 * Expose / Mass Expose (White Spell #19)
 *
 * Basic (Expose): Target enemy loses all fortifications and resistances. Ranged Attack 2.
 * - Uses compound effect: first targets enemy to apply modifiers, then grants ranged attack
 * - Applies ability nullifier for FORTIFIED and resistance removal to target
 *
 * Powered (Mass Expose): All enemies lose fortifications OR resistances (choice). Ranged Attack 3.
 * - Player chooses between removing fortification from ALL enemies or removing resistances from ALL enemies
 * - Then gains Ranged Attack 3
 *
 * Note: Arcane Immunity blocks the modifier effects (but ranged attack still works).
 */

import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import {
  EFFECT_COMPOUND,
  EFFECT_GAIN_ATTACK,
  EFFECT_SELECT_COMBAT_ENEMY,
  EFFECT_CHOICE,
  EFFECT_APPLY_MODIFIER,
  COMBAT_TYPE_RANGED,
} from "../../../types/effectTypes.js";
import {
  MANA_WHITE,
  MANA_BLACK,
  CARD_EXPOSE,
  ABILITY_FORTIFIED,
} from "@mage-knight/shared";
import {
  DURATION_COMBAT,
  EFFECT_ABILITY_NULLIFIER,
  EFFECT_REMOVE_RESISTANCES,
  SCOPE_ALL_ENEMIES,
} from "../../../types/modifierConstants.js";

export const EXPOSE: DeedCard = {
  id: CARD_EXPOSE,
  name: "Expose",
  poweredName: "Mass Expose",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_COMBAT],
  poweredBy: [MANA_BLACK, MANA_WHITE],
  basicEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      // First: Target enemy and remove fortification + resistances
      {
        type: EFFECT_SELECT_COMBAT_ENEMY,
        template: {
          modifiers: [
            {
              modifier: { type: EFFECT_ABILITY_NULLIFIER, ability: ABILITY_FORTIFIED },
              duration: DURATION_COMBAT,
              description: "Target enemy loses fortification",
            },
            {
              modifier: { type: EFFECT_REMOVE_RESISTANCES },
              duration: DURATION_COMBAT,
              description: "Target enemy loses all resistances",
            },
          ],
        },
      },
      // Second: Gain Ranged Attack 2
      {
        type: EFFECT_GAIN_ATTACK,
        amount: 2,
        combatType: COMBAT_TYPE_RANGED,
      },
    ],
  },
  poweredEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      // First: Choice - remove fortification from all OR remove resistances from all
      {
        type: EFFECT_CHOICE,
        options: [
          {
            type: EFFECT_APPLY_MODIFIER,
            scope: { type: SCOPE_ALL_ENEMIES },
            duration: DURATION_COMBAT,
            modifier: { type: EFFECT_ABILITY_NULLIFIER, ability: ABILITY_FORTIFIED },
            description: "All enemies lose fortification",
          },
          {
            type: EFFECT_APPLY_MODIFIER,
            scope: { type: SCOPE_ALL_ENEMIES },
            duration: DURATION_COMBAT,
            modifier: { type: EFFECT_REMOVE_RESISTANCES },
            description: "All enemies lose resistances",
          },
        ],
      },
      // Second: Gain Ranged Attack 3
      {
        type: EFFECT_GAIN_ATTACK,
        amount: 3,
        combatType: COMBAT_TYPE_RANGED,
      },
    ],
  },
  sidewaysValue: 1,
};
