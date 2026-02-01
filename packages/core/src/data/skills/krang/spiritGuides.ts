/**
 * Spirit Guides - Krang Skill
 * @module data/skills/krang/spiritGuides
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_MOVEMENT, CATEGORY_COMBAT } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_KRANG_SPIRIT_GUIDES = "krang_spirit_guides" as SkillId;

export const spiritGuides: SkillDefinition = {
  id: SKILL_KRANG_SPIRIT_GUIDES,
    name: "Spirit Guides",
    heroId: "krang",
    description: "Move 1 and may add +1 to a Block",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_MOVEMENT, CATEGORY_COMBAT],
};
