/**
 * Thunderstorm - Braevalar Skill
 * @module data/skills/braevalar/thunderstorm
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_BRAEVALAR_THUNDERSTORM = "braevalar_thunderstorm" as SkillId;

export const thunderstorm: SkillDefinition = {
  id: SKILL_BRAEVALAR_THUNDERSTORM,
    name: "Thunderstorm",
    heroId: "braevalar",
    description: "Flip to gain 1 green/blue mana and 1 green/white mana",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_SPECIAL],
};
