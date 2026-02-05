/**
 * Freezing Power - Goldyx Skill
 * @module data/skills/goldyx/freezingPower
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { choice, iceSiegeAttack, siegeAttack } from "../../effectHelpers.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_GOLDYX_FREEZING_POWER = "goldyx_freezing_power" as SkillId;

export const freezingPower: SkillDefinition = {
  id: SKILL_GOLDYX_FREEZING_POWER,
  name: "Freezing Power",
  heroId: "goldyx",
  description: "Siege Attack 1 or Ice Siege Attack 1",
  usageType: SKILL_USAGE_ONCE_PER_TURN,
  effect: choice([siegeAttack(1), iceSiegeAttack(1)]),
  categories: [CATEGORY_COMBAT],
};
