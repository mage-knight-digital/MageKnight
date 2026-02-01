/**
 * Lightning Storm - Braevalar Skill
 * @module data/skills/braevalar/lightningStorm
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_BRAEVALAR_LIGHTNING_STORM = "braevalar_lightning_storm" as SkillId;

export const lightningStorm: SkillDefinition = {
  id: SKILL_BRAEVALAR_LIGHTNING_STORM,
    name: "Lightning Storm",
    heroId: "braevalar",
    description: "Flip to gain 1 blue/green mana and 1 blue/red mana",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_SPECIAL],
};
