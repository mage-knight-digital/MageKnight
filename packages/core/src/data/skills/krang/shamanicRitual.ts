/**
 * Shamanic Ritual - Krang Skill
 * @module data/skills/krang/shamanicRitual
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_KRANG_SHAMANIC_RITUAL = "krang_shamanic_ritual" as SkillId;

export const shamanicRitual: SkillDefinition = {
  id: SKILL_KRANG_SHAMANIC_RITUAL,
    name: "Shamanic Ritual",
    heroId: "krang",
    description: "Flip to gain mana of any color. May flip back as action",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_SPECIAL],
};
