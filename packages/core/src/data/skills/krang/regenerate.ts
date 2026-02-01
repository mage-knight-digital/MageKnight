/**
 * Regenerate - Krang Skill
 * @module data/skills/krang/regenerate
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_HEALING } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_KRANG_REGENERATE = "krang_regenerate" as SkillId;

export const krangRegenerate: SkillDefinition = {
  id: SKILL_KRANG_REGENERATE,
    name: "Regenerate",
    heroId: "krang",
    description: "Pay mana, discard Wound. Red mana or lowest Fame: draw card",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_HEALING],
};
