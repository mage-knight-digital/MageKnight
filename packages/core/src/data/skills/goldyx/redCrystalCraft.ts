/**
 * Red Crystal Craft - Goldyx Skill
 * @module data/skills/goldyx/redCrystalCraft
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_GOLDYX_RED_CRYSTAL_CRAFT = "goldyx_red_crystal_craft" as SkillId;

export const redCrystalCraft: SkillDefinition = {
  id: SKILL_GOLDYX_RED_CRYSTAL_CRAFT,
    name: "Red Crystal Craft",
    heroId: "goldyx",
    description: "Flip to gain 1 blue crystal and 1 red mana token",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_SPECIAL],
};
