/**
 * Resistance Break - Tovak Skill
 * @module data/skills/tovak/resistanceBreak
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_TOVAK_RESISTANCE_BREAK = "tovak_resistance_break" as SkillId;

export const resistanceBreak: SkillDefinition = {
  id: SKILL_TOVAK_RESISTANCE_BREAK,
    name: "Resistance Break",
    heroId: "tovak",
    description: "Target enemy: Armor -1 for each resistance it has (min 1)",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
};
