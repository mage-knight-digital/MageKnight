/**
 * Beguile - Braevalar Skill
 * @module data/skills/braevalar/beguile
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_INFLUENCE } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_BRAEVALAR_BEGUILE = "braevalar_beguile" as SkillId;

export const beguile: SkillDefinition = {
  id: SKILL_BRAEVALAR_BEGUILE,
    name: "Beguile",
    heroId: "braevalar",
    description: "Influence 3. Fortified: 2. Magical Glade: 4",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_INFLUENCE],
};
