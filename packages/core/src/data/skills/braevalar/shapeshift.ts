/**
 * Shapeshift - Braevalar Skill
 * @module data/skills/braevalar/shapeshift
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_BRAEVALAR_SHAPESHIFT = "braevalar_shapeshift" as SkillId;

export const shapeshift: SkillDefinition = {
  id: SKILL_BRAEVALAR_SHAPESHIFT,
    name: "Shapeshift",
    heroId: "braevalar",
    description: "Basic Action with Move/Attack/Block becomes another type",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_SPECIAL],
};
