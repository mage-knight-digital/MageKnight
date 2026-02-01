/**
 * Mana Suppression - Krang Skill
 * @module data/skills/krang/manaSuppression
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_INTERACTIVE } from "../types.js";

export const SKILL_KRANG_MANA_SUPPRESSION = "krang_mana_suppression" as SkillId;

export const manaSuppression: SkillDefinition = {
  id: SKILL_KRANG_MANA_SUPPRESSION,
    name: "Mana Suppression",
    heroId: "krang",
    description: "First mana each turn costs extra. Gain crystal from tokens",
    usageType: SKILL_USAGE_INTERACTIVE,
    categories: [CATEGORY_SPECIAL],
};
