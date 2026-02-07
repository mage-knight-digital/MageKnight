/**
 * Prayer of Weather - Norowas Skill
 *
 * Once a round: The move cost of all terrains is reduced by 2 (to a minimum of 1)
 * for you this turn. Put this in the center. Any player may return it to you face
 * down to reduce the move cost of all terrains by 1 (to a minimum of 1) for them
 * on their turn.
 *
 * @module data/skills/norowas/prayerOfWeather
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_MOVEMENT } from "../../../types/cards.js";
import {
  EFFECT_APPLY_MODIFIER,
  EFFECT_COMPOUND,
  EFFECT_PLACE_SKILL_IN_CENTER,
} from "../../../types/effectTypes.js";
import {
  DURATION_TURN,
  EFFECT_TERRAIN_COST,
  TERRAIN_ALL,
} from "../../../types/modifierConstants.js";
import { type SkillDefinition, SKILL_USAGE_INTERACTIVE } from "../types.js";

export const SKILL_NOROWAS_PRAYER_OF_WEATHER = "norowas_prayer_of_weather" as SkillId;

export const prayerOfWeather: SkillDefinition = {
  id: SKILL_NOROWAS_PRAYER_OF_WEATHER,
  name: "Prayer of Weather",
  heroId: "norowas",
  description:
    "Terrain costs -2 for you. Others may return to get -1 terrain cost",
  usageType: SKILL_USAGE_INTERACTIVE,
  categories: [CATEGORY_MOVEMENT],
  effect: {
    type: EFFECT_COMPOUND,
    effects: [
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_ALL,
          amount: -2,
          minimum: 1,
        },
        duration: DURATION_TURN,
        description: "All terrain costs -2 this turn (min 1)",
      },
      {
        type: EFFECT_PLACE_SKILL_IN_CENTER,
        skillId: SKILL_NOROWAS_PRAYER_OF_WEATHER,
      },
    ],
  },
};
