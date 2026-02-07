/**
 * Potion Making - Goldyx Skill
 * @module data/skills/goldyx/potionMaking
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_HEALING } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";
import { heal } from "../../effectHelpers.js";

export const SKILL_GOLDYX_POTION_MAKING = "goldyx_potion_making" as SkillId;

export const potionMaking: SkillDefinition = {
  id: SKILL_GOLDYX_POTION_MAKING,
  name: "Potion Making",
  heroId: "goldyx",
  description: "Flip for Heal 2 (except in combat)",
  usageType: SKILL_USAGE_ONCE_PER_ROUND,
  categories: [CATEGORY_HEALING],
  effect: heal(2),
};
