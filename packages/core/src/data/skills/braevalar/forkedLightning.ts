/**
 * Forked Lightning - Braevalar Skill
 *
 * Once per turn: Ranged Cold Fire Attack 1 against up to 3 different enemies.
 *
 * Key rules:
 * - Each target receives exactly 1 Cold Fire Ranged Attack (S3: cannot combine)
 * - Must target different enemies (up to 3)
 * - All attacks must be in the same sub-phase (S5)
 * - Can target enemies in different groups (A4) as long as same sub-phase
 * - Single enemy: only 1 attack point can be used (S3)
 *
 * @module data/skills/braevalar/forkedLightning
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { EFFECT_SELECT_COMBAT_ENEMY, EFFECT_GAIN_ATTACK, COMBAT_TYPE_RANGED } from "../../../types/effectTypes.js";
import { ELEMENT_COLD_FIRE } from "@mage-knight/shared";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_BRAEVALAR_FORKED_LIGHTNING = "braevalar_forked_lightning" as SkillId;

export const forkedLightning: SkillDefinition = {
  id: SKILL_BRAEVALAR_FORKED_LIGHTNING,
    name: "Forked Lightning",
    heroId: "braevalar",
    description: "Ranged Cold Fire Attack 1 against up to 3 enemies",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
    effect: {
      type: EFFECT_SELECT_COMBAT_ENEMY,
      maxTargets: 3,
      template: {
        bundledEffect: {
          type: EFFECT_GAIN_ATTACK,
          amount: 1,
          combatType: COMBAT_TYPE_RANGED,
          element: ELEMENT_COLD_FIRE,
        },
      },
    },
};
