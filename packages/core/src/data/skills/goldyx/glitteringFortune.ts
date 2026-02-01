/**
 * Glittering Fortune - Goldyx Skill
 * @module data/skills/goldyx/glitteringFortune
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_INFLUENCE } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_GOLDYX_GLITTERING_FORTUNE = "goldyx_glittering_fortune" as SkillId;

export const glitteringFortune: SkillDefinition = {
  id: SKILL_GOLDYX_GLITTERING_FORTUNE,
    name: "Glittering Fortune",
    heroId: "goldyx",
    description: "During interaction: Influence 1 per different color crystal",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_INFLUENCE],
};
