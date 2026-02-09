/**
 * Mana Enhancement - Krang Skill
 * @module data/skills/krang/manaEnhancement
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_INTERACTIVE } from "../types.js";

export const SKILL_KRANG_MANA_ENHANCEMENT = "krang_mana_enhancement" as SkillId;

export const manaEnhancement: SkillDefinition = {
  id: SKILL_KRANG_MANA_ENHANCEMENT,
  name: "Mana Enhancement",
  heroId: "krang",
  description:
    "Once per round, when you spend basic mana, gain a crystal and place this skill token in the center until your next turn.",
  usageType: SKILL_USAGE_INTERACTIVE,
  categories: [CATEGORY_SPECIAL],
};
