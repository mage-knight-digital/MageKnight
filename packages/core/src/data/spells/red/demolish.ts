/**
 * Demolish / Disintegrate (Red Spell #12)
 *
 * Basic (Demolish):
 *   Ignore site fortifications this turn. All enemies get Armor -1 (to a minimum of 1).
 *   Fire Resistant enemies are unaffected by the armor reduction.
 *   Arcane Immune enemies are unaffected by the armor reduction.
 *   Site fortification bypass targets the structure, not the enemy, so it works
 *   regardless of resistances.
 *
 * Powered (Disintegrate):
 *   Attack phase only. Destroy target enemy. Other enemies get Armor -1 (to a minimum of 1).
 *   Cannot target Fire Resistant or Arcane Immune enemies for destruction.
 *   Armor reduction only applies if the target is successfully destroyed.
 *   Fire Resistant/Arcane Immune enemies are unaffected by the armor reduction.
 */

import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import {
  EFFECT_COMPOUND,
  EFFECT_APPLY_MODIFIER,
  EFFECT_SELECT_COMBAT_ENEMY,
} from "../../../types/effectTypes.js";
import {
  MANA_RED,
  MANA_BLACK,
  CARD_DEMOLISH,
  RESIST_FIRE,
} from "@mage-knight/shared";
import {
  DURATION_TURN,
  DURATION_COMBAT,
  EFFECT_RULE_OVERRIDE,
  RULE_IGNORE_FORTIFICATION,
  EFFECT_ENEMY_STAT,
  ENEMY_STAT_ARMOR,
  SCOPE_ALL_ENEMIES,
} from "../../../types/modifierConstants.js";
import { COMBAT_PHASE_ATTACK } from "../../../types/combat.js";

export const DEMOLISH: DeedCard = {
  id: CARD_DEMOLISH,
  name: "Demolish",
  poweredName: "Disintegrate",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_COMBAT],
  poweredBy: [MANA_BLACK, MANA_RED],
  basicEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      // Ignore site fortifications this turn
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_RULE_OVERRIDE,
          rule: RULE_IGNORE_FORTIFICATION,
        },
        duration: DURATION_TURN,
        description: "Ignore site fortifications this turn",
      },
      // All enemies get Armor -1 (Fire Resistant/Arcane Immune unaffected)
      {
        type: EFFECT_APPLY_MODIFIER,
        scope: { type: SCOPE_ALL_ENEMIES },
        duration: DURATION_COMBAT,
        modifier: {
          type: EFFECT_ENEMY_STAT,
          stat: ENEMY_STAT_ARMOR,
          amount: -1,
          minimum: 1,
          excludeResistance: RESIST_FIRE,
        },
        description: "All enemies get Armor -1",
      },
    ],
  },
  poweredEffect: {
    type: EFFECT_SELECT_COMBAT_ENEMY,
    template: {
      defeat: true,
      bundledEffect: {
        type: EFFECT_APPLY_MODIFIER,
        scope: { type: SCOPE_ALL_ENEMIES },
        duration: DURATION_COMBAT,
        modifier: {
          type: EFFECT_ENEMY_STAT,
          stat: ENEMY_STAT_ARMOR,
          amount: -1,
          minimum: 1,
          excludeResistance: RESIST_FIRE,
        },
        description: "All enemies get Armor -1",
      },
    },
    requiredPhase: COMBAT_PHASE_ATTACK,
    excludeArcaneImmune: true,
    excludeResistance: RESIST_FIRE,
  },
  sidewaysValue: 1,
};
