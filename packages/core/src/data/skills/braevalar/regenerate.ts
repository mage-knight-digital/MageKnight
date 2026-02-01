/**
 * Regenerate - Braevalar Skill
 * @module data/skills/braevalar/regenerate
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_HEALING } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_BRAEVALAR_REGENERATE = "braevalar_regenerate" as SkillId;

export const braevalarRegenerate: SkillDefinition = {
  id: SKILL_BRAEVALAR_REGENERATE,
    name: "Regenerate",
    heroId: "braevalar",
    description: "Pay mana, discard Wound. Red mana or lowest Fame: draw card",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_HEALING],
};
