/**
 * Curse - Krang Skill
 * @module data/skills/krang/curse
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_KRANG_CURSE = "krang_curse" as SkillId;

export const curse: SkillDefinition = {
  id: SKILL_KRANG_CURSE,
    name: "Curse",
    heroId: "krang",
    description: "Enemy Attack -1 or Armor -1 (min 1). Not vs fortified in Ranged",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
};
