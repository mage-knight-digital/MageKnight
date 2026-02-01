/**
 * Dark Fire Magic - Arythea Skill
 * @module data/skills/arythea/darkFireMagic
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_ARYTHEA_DARK_FIRE_MAGIC = "arythea_dark_fire_magic" as SkillId;

export const darkFireMagic: SkillDefinition = {
  id: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
    name: "Dark Fire Magic",
    heroId: "arythea",
    description: "Flip to gain 1 red crystal and 1 red or black mana token",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_SPECIAL],
};
