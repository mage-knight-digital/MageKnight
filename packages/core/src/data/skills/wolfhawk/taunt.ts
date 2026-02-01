/**
 * Taunt - Wolfhawk Skill
 * @module data/skills/wolfhawk/taunt
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_WOLFHAWK_TAUNT = "wolfhawk_taunt" as SkillId;

export const taunt: SkillDefinition = {
  id: SKILL_WOLFHAWK_TAUNT,
    name: "Taunt",
    heroId: "wolfhawk",
    description: "Block phase: Enemy attack -1, OR +2 attack but armor -2",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
};
