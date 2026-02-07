/**
 * Leadership - Norowas Skill
 *
 * Once per turn: When activating a Unit, add +3 to its Block,
 * or +2 to its Attack, or +1 to its Ranged (not Siege) Attack,
 * regardless of its element.
 *
 * The bonus is applied via a modifier that is consumed on the next
 * unit activation. The chosen bonus must match an ability the unit has.
 *
 * @module data/skills/norowas/leadership
 */

import type { SkillId } from "@mage-knight/shared";
import type { ApplyModifierEffect } from "../../../types/cards.js";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { EFFECT_APPLY_MODIFIER } from "../../../types/effectTypes.js";
import {
  DURATION_TURN,
  SCOPE_SELF,
  EFFECT_LEADERSHIP_BONUS,
  LEADERSHIP_BONUS_BLOCK,
  LEADERSHIP_BONUS_ATTACK,
  LEADERSHIP_BONUS_RANGED_ATTACK,
} from "../../../types/modifierConstants.js";
import { choice } from "../../effectHelpers.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_NOROWAS_LEADERSHIP = "norowas_leadership" as SkillId;

const blockBonus: ApplyModifierEffect = {
  type: EFFECT_APPLY_MODIFIER,
  modifier: {
    type: EFFECT_LEADERSHIP_BONUS,
    bonusType: LEADERSHIP_BONUS_BLOCK,
    amount: 3,
  },
  duration: DURATION_TURN,
  scope: { type: SCOPE_SELF },
  description: "+3 Block to next unit activation",
};

const attackBonus: ApplyModifierEffect = {
  type: EFFECT_APPLY_MODIFIER,
  modifier: {
    type: EFFECT_LEADERSHIP_BONUS,
    bonusType: LEADERSHIP_BONUS_ATTACK,
    amount: 2,
  },
  duration: DURATION_TURN,
  scope: { type: SCOPE_SELF },
  description: "+2 Attack to next unit activation",
};

const rangedBonus: ApplyModifierEffect = {
  type: EFFECT_APPLY_MODIFIER,
  modifier: {
    type: EFFECT_LEADERSHIP_BONUS,
    bonusType: LEADERSHIP_BONUS_RANGED_ATTACK,
    amount: 1,
  },
  duration: DURATION_TURN,
  scope: { type: SCOPE_SELF },
  description: "+1 Ranged Attack to next unit activation",
};

export const leadership: SkillDefinition = {
  id: SKILL_NOROWAS_LEADERSHIP,
  name: "Leadership",
  heroId: "norowas",
  description: "When activating Unit: +3 Block, +2 Attack, or +1 Ranged Attack",
  usageType: SKILL_USAGE_ONCE_PER_TURN,
  categories: [CATEGORY_COMBAT],
  effect: choice([blockBonus, attackBonus, rangedBonus]),
};
