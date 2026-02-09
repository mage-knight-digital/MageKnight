/**
 * Dodge and Weave (White Advanced Action)
 *
 * Basic: Reduce one enemy attack by 2.
 *   Gain Attack 1 in Attack phase if no wounds added to hand this combat.
 *
 * Powered (White): Reduce one enemy attack by 4 OR two attacks by 2 each.
 *   Gain Attack 2 in Attack phase if no wounds added to hand this combat.
 *
 * This is NOT a block effect — it reduces the enemy's attack value itself,
 * which affects Swiftness (doubled block needed) and Brutal (doubled damage).
 * The attack bonus is physical (non-elemental).
 */

import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { EFFECT_SELECT_COMBAT_ENEMY } from "../../../types/effectTypes.js";
import { MANA_WHITE, CARD_DODGE_AND_WEAVE } from "@mage-knight/shared";
import { compound, choice } from "../helpers.js";
import {
  DURATION_COMBAT,
  EFFECT_ENEMY_STAT,
  ENEMY_STAT_ATTACK,
  EFFECT_DODGE_AND_WEAVE_ATTACK_BONUS,
  SCOPE_SELF,
} from "../../../types/modifierConstants.js";
import { COMBAT_PHASE_BLOCK } from "../../../types/combat.js";
import { EFFECT_APPLY_MODIFIER } from "../../../types/effectTypes.js";

export const DODGE_AND_WEAVE: DeedCard = {
  id: CARD_DODGE_AND_WEAVE,
  name: "Dodge and Weave",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CATEGORY_COMBAT],
  basicEffect: compound(
    // Conditional Attack 1 (evaluated at phase transition to Attack)
    // Must be first: compound stops at choice-requiring effects
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_DODGE_AND_WEAVE_ATTACK_BONUS,
        amount: 1,
      },
      duration: DURATION_COMBAT,
      scope: { type: SCOPE_SELF },
      description: "Attack 1 if no wounds this combat",
    },
    // Reduce one enemy attack by 2
    {
      type: EFFECT_SELECT_COMBAT_ENEMY,
      template: {
        modifiers: [
          {
            modifier: {
              type: EFFECT_ENEMY_STAT,
              stat: ENEMY_STAT_ATTACK,
              amount: -2,
              minimum: 0,
            },
            duration: DURATION_COMBAT,
            description: "Reduce enemy attack by 2",
          },
        ],
      },
      requiredPhase: COMBAT_PHASE_BLOCK,
    }
  ),
  poweredEffect: compound(
    // Conditional Attack 2 (evaluated at phase transition to Attack)
    // Must be first: compound stops at choice-requiring effects
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_DODGE_AND_WEAVE_ATTACK_BONUS,
        amount: 2,
      },
      duration: DURATION_COMBAT,
      scope: { type: SCOPE_SELF },
      description: "Attack 2 if no wounds this combat",
    },
    // Choice: Reduce one attack by 4 OR two attacks by 2 each
    choice(
      // Option 1: Reduce one enemy attack by 4
      {
        type: EFFECT_SELECT_COMBAT_ENEMY,
        template: {
          modifiers: [
            {
              modifier: {
                type: EFFECT_ENEMY_STAT,
                stat: ENEMY_STAT_ATTACK,
                amount: -4,
                minimum: 0,
              },
              duration: DURATION_COMBAT,
              description: "Reduce enemy attack by 4",
            },
          ],
        },
        requiredPhase: COMBAT_PHASE_BLOCK,
      },
      // Option 2: Reduce two attacks by 2 each (can target same or different enemies)
      {
        type: EFFECT_SELECT_COMBAT_ENEMY,
        template: {
          modifiers: [
            {
              modifier: {
                type: EFFECT_ENEMY_STAT,
                stat: ENEMY_STAT_ATTACK,
                amount: -2,
                minimum: 0,
              },
              duration: DURATION_COMBAT,
              description: "Reduce enemy attack by 2",
            },
          ],
        },
        maxTargets: 2,
        requiredPhase: COMBAT_PHASE_BLOCK,
      }
    )
  ),
  sidewaysValue: 1,
};
