/**
 * Elemental Resistance - Braevalar Skill
 * @module data/skills/braevalar/elementalResistance
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_BRAEVALAR_ELEMENTAL_RESISTANCE = "braevalar_elemental_resistance" as SkillId;

export const elementalResistance: SkillDefinition = {
  id: SKILL_BRAEVALAR_ELEMENTAL_RESISTANCE,
    name: "Elemental Resistance",
    heroId: "braevalar",
    description: "Ignore 2 Fire/Ice damage or 1 other damage",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
};
