/**
 * Cold Swordsmanship - Tovak Skill
 * @module data/skills/tovak/coldSwordsmanship
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { attack, choice, iceAttack } from "../../effectHelpers.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_TOVAK_COLD_SWORDSMANSHIP = "tovak_cold_swordsmanship" as SkillId;

export const coldSwordsmanship: SkillDefinition = {
  id: SKILL_TOVAK_COLD_SWORDSMANSHIP,
  name: "Cold Swordsmanship",
  heroId: "tovak",
  description: "Attack 2 or Ice Attack 2",
  usageType: SKILL_USAGE_ONCE_PER_TURN,
  effect: choice([attack(2), iceAttack(2)]),
  categories: [CATEGORY_COMBAT],
};
