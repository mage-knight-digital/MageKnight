/**
 * Forked Lightning - Braevalar Skill
 * @module data/skills/braevalar/forkedLightning
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_BRAEVALAR_FORKED_LIGHTNING = "braevalar_forked_lightning" as SkillId;

export const forkedLightning: SkillDefinition = {
  id: SKILL_BRAEVALAR_FORKED_LIGHTNING,
    name: "Forked Lightning",
    heroId: "braevalar",
    description: "Ranged Cold Fire Attack 1 against up to 3 enemies",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
};
