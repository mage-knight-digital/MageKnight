/**
 * Prayer of Weather - Norowas Skill
 * @module data/skills/norowas/prayerOfWeather
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_MOVEMENT } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_INTERACTIVE } from "../types.js";

export const SKILL_NOROWAS_PRAYER_OF_WEATHER = "norowas_prayer_of_weather" as SkillId;

export const prayerOfWeather: SkillDefinition = {
  id: SKILL_NOROWAS_PRAYER_OF_WEATHER,
  name: "Prayer of Weather",
  heroId: "norowas",
  description: "Until your next turn: your terrain costs -2, others' costs +1",
  usageType: SKILL_USAGE_INTERACTIVE,
  categories: [CATEGORY_MOVEMENT],
};
