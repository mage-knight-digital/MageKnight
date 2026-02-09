/**
 * Shamanic Ritual - Krang Skill
 * @module data/skills/krang/shamanicRitual
 */

import type { SkillId } from "@mage-knight/shared";
import {
  MANA_BLACK,
  MANA_BLUE,
  MANA_GOLD,
  MANA_GREEN,
  MANA_RED,
  MANA_WHITE,
} from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { EFFECT_CHOICE, EFFECT_GAIN_MANA } from "../../../types/effectTypes.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_KRANG_SHAMANIC_RITUAL = "krang_shamanic_ritual" as SkillId;

export const shamanicRitual: SkillDefinition = {
  id: SKILL_KRANG_SHAMANIC_RITUAL,
  name: "Shamanic Ritual",
  heroId: "krang",
  description: "Flip to gain mana of any color. May flip back as action",
  usageType: SKILL_USAGE_ONCE_PER_ROUND,
  categories: [CATEGORY_SPECIAL],
  effect: {
    type: EFFECT_CHOICE,
    options: [
      { type: EFFECT_GAIN_MANA, color: MANA_RED },
      { type: EFFECT_GAIN_MANA, color: MANA_BLUE },
      { type: EFFECT_GAIN_MANA, color: MANA_GREEN },
      { type: EFFECT_GAIN_MANA, color: MANA_WHITE },
      { type: EFFECT_GAIN_MANA, color: MANA_GOLD },
      { type: EFFECT_GAIN_MANA, color: MANA_BLACK },
    ],
  },
};
