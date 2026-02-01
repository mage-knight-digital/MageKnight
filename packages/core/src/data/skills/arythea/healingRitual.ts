/**
 * Healing Ritual - Arythea Skill
 * @module data/skills/arythea/healingRitual
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_HEALING } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_INTERACTIVE } from "../types.js";

export const SKILL_ARYTHEA_HEALING_RITUAL = "arythea_healing_ritual" as SkillId;

export const healingRitual: SkillDefinition = {
  id: SKILL_ARYTHEA_HEALING_RITUAL,
    name: "Healing Ritual",
    heroId: "arythea",
    description: "Flip (except combat): Discard up to 2 Wounds, one goes to closest hero",
    usageType: SKILL_USAGE_INTERACTIVE,
    categories: [CATEGORY_HEALING],
};
