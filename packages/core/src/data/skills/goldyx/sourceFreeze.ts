/**
 * Source Freeze - Goldyx Skill
 * @module data/skills/goldyx/sourceFreeze
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_INTERACTIVE } from "../types.js";

export const SKILL_GOLDYX_SOURCE_FREEZE = "goldyx_source_freeze" as SkillId;

export const sourceFreeze: SkillDefinition = {
  id: SKILL_GOLDYX_SOURCE_FREEZE,
    name: "Source Freeze",
    heroId: "goldyx",
    description: "Place in Source. Others can't use standard die. Gain crystal on next turn",
    usageType: SKILL_USAGE_INTERACTIVE,
    categories: [CATEGORY_SPECIAL],
};
