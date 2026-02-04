/**
 * Burning Power - Arythea Skill
 * @module data/skills/arythea/burningPower
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { choice, fireSiegeAttack, siegeAttack } from "../../effectHelpers.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_ARYTHEA_BURNING_POWER = "arythea_burning_power" as SkillId;

export const burningPower: SkillDefinition = {
  id: SKILL_ARYTHEA_BURNING_POWER,
  name: "Burning Power",
  heroId: "arythea",
  description: "Siege Attack 1 or Fire Siege Attack 1",
  usageType: SKILL_USAGE_ONCE_PER_TURN,
  effect: choice([siegeAttack(1), fireSiegeAttack(1)]),
  categories: [CATEGORY_COMBAT],
};
