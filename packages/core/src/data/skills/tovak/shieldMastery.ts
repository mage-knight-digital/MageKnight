/**
 * Shield Mastery - Tovak Skill
 * @module data/skills/tovak/shieldMastery
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_TOVAK_SHIELD_MASTERY = "tovak_shield_mastery" as SkillId;

export const shieldMastery: SkillDefinition = {
  id: SKILL_TOVAK_SHIELD_MASTERY,
    name: "Shield Mastery",
    heroId: "tovak",
    description: "Block 3, or Fire Block 2, or Ice Block 2",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
};
