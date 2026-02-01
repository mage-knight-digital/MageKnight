/**
 * Universal Power - Goldyx Skill
 * @module data/skills/goldyx/universalPower
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_GOLDYX_UNIVERSAL_POWER = "goldyx_universal_power" as SkillId;

export const universalPower: SkillDefinition = {
  id: SKILL_GOLDYX_UNIVERSAL_POWER,
    name: "Universal Power",
    heroId: "goldyx",
    description: "Add 1 mana to sideways card: +3 instead of +1. Same color: +4",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_SPECIAL],
};
