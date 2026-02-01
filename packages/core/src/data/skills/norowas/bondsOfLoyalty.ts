/**
 * Bonds of Loyalty - Norowas Skill
 * @module data/skills/norowas/bondsOfLoyalty
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_PASSIVE } from "../types.js";

export const SKILL_NOROWAS_BONDS_OF_LOYALTY = "norowas_bonds_of_loyalty" as SkillId;

export const bondsOfLoyalty: SkillDefinition = {
  id: SKILL_NOROWAS_BONDS_OF_LOYALTY,
  name: "Bonds of Loyalty",
  heroId: "norowas",
  description: "Acts as Command token. Unit costs -5 Influence. Cannot be disbanded",
  usageType: SKILL_USAGE_PASSIVE,
  categories: [CATEGORY_SPECIAL],
};
