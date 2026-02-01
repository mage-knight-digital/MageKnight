/**
 * Dark Paths - Arythea Skill
 * @module data/skills/arythea/darkPaths
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_MOVEMENT } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_ARYTHEA_DARK_PATHS = "arythea_dark_paths" as SkillId;

export const darkPaths: SkillDefinition = {
  id: SKILL_ARYTHEA_DARK_PATHS,
    name: "Dark Paths",
    heroId: "arythea",
    description: "Move 1 (Day) or Move 2 (Night)",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_MOVEMENT],
};
