/**
 * Know Your Prey - Wolfhawk Skill
 * @module data/skills/wolfhawk/knowYourPrey
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_WOLFHAWK_KNOW_YOUR_PREY = "wolfhawk_know_your_prey" as SkillId;

export const knowYourPrey: SkillDefinition = {
  id: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
    name: "Know Your Prey",
    heroId: "wolfhawk",
    description: "Flip to ignore one enemy ability or remove attack element",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_COMBAT],
};
