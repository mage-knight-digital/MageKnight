/**
 * Nature's Vengeance - Braevalar Skill
 * @module data/skills/braevalar/naturesVengeance
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_INTERACTIVE } from "../types.js";

export const SKILL_BRAEVALAR_NATURES_VENGEANCE = "braevalar_natures_vengeance" as SkillId;

export const naturesVengeance: SkillDefinition = {
  id: SKILL_BRAEVALAR_NATURES_VENGEANCE,
    name: "Nature's Vengeance",
    heroId: "braevalar",
    description: "Reduce enemy attack by 1, gains Cumbersome. Others' enemies +1 attack",
    usageType: SKILL_USAGE_INTERACTIVE,
    categories: [CATEGORY_COMBAT],
};
