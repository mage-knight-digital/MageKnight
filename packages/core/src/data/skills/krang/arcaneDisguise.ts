/**
 * Arcane Disguise - Krang Skill
 * @module data/skills/krang/arcaneDisguise
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_INFLUENCE } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_KRANG_ARCANE_DISGUISE = "krang_arcane_disguise" as SkillId;

export const arcaneDisguise: SkillDefinition = {
  id: SKILL_KRANG_ARCANE_DISGUISE,
    name: "Arcane Disguise",
    heroId: "krang",
    description: "Influence 2, or flip to ignore reputation. Green mana to flip back",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_INFLUENCE],
};
