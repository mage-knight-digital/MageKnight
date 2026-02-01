/**
 * Dueling - Wolfhawk Skill
 * @module data/skills/wolfhawk/dueling
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_WOLFHAWK_DUELING = "wolfhawk_dueling" as SkillId;

export const dueling: SkillDefinition = {
  id: SKILL_WOLFHAWK_DUELING,
    name: "Dueling",
    heroId: "wolfhawk",
    description: "Block 1 and Attack 1 vs same enemy. +1 Fame without Units",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
};
