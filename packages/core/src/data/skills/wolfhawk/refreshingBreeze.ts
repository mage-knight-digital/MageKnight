/**
 * Refreshing Breeze - Wolfhawk Skill
 * @module data/skills/wolfhawk/refreshingBreeze
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_HEALING, CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_WOLFHAWK_REFRESHING_BREEZE = "wolfhawk_refreshing_breeze" as SkillId;

export const refreshingBreeze: SkillDefinition = {
  id: SKILL_WOLFHAWK_REFRESHING_BREEZE,
    name: "Refreshing Breeze",
    heroId: "wolfhawk",
    description: "Flip for Heal 1 and 1 white crystal (except combat)",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_HEALING, CATEGORY_SPECIAL],
};
