/**
 * Hot Swordsmanship - Arythea Skill
 * @module data/skills/arythea/hotSwordsmanship
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_ARYTHEA_HOT_SWORDSMANSHIP = "arythea_hot_swordsmanship" as SkillId;

export const hotSwordsmanship: SkillDefinition = {
  id: SKILL_ARYTHEA_HOT_SWORDSMANSHIP,
    name: "Hot Swordsmanship",
    heroId: "arythea",
    description: "Attack 2 or Fire Attack 2",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
};
