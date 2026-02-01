/**
 * Deadly Aim - Wolfhawk Skill
 * @module data/skills/wolfhawk/deadlyAim
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_WOLFHAWK_DEADLY_AIM = "wolfhawk_deadly_aim" as SkillId;

export const deadlyAim: SkillDefinition = {
  id: SKILL_WOLFHAWK_DEADLY_AIM,
    name: "Deadly Aim",
    heroId: "wolfhawk",
    description: "Ranged/Siege: +1 to Attack. Attack phase: +2 to Attack",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
};
