/**
 * Power of Pain - Arythea Skill
 * @module data/skills/arythea/powerOfPain
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_ARYTHEA_POWER_OF_PAIN = "arythea_power_of_pain" as SkillId;

export const powerOfPain: SkillDefinition = {
  id: SKILL_ARYTHEA_POWER_OF_PAIN,
    name: "Power of Pain",
    heroId: "arythea",
    description: "Play 1 Wound sideways as non-Wound card: +2 instead of +1",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_SPECIAL],
};
