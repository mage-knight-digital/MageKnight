/**
 * Refreshing Bath - Wolfhawk Skill
 * @module data/skills/wolfhawk/refreshingBath
 */

import type { SkillId } from "@mage-knight/shared";
import { MANA_BLUE } from "@mage-knight/shared";
import { CATEGORY_HEALING, CATEGORY_SPECIAL } from "../../../types/cards.js";
import { EFFECT_GAIN_CRYSTAL, EFFECT_GAIN_HEALING } from "../../../types/effectTypes.js";
import { compound } from "../../effectHelpers.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_WOLFHAWK_REFRESHING_BATH = "wolfhawk_refreshing_bath" as SkillId;

export const refreshingBath: SkillDefinition = {
  id: SKILL_WOLFHAWK_REFRESHING_BATH,
  name: "Refreshing Bath",
  heroId: "wolfhawk",
  description: "Flip for Heal 1 and 1 blue crystal (except combat)",
  usageType: SKILL_USAGE_ONCE_PER_ROUND,
  categories: [CATEGORY_HEALING, CATEGORY_SPECIAL],
  effect: compound([
    { type: EFFECT_GAIN_HEALING, amount: 1 },
    { type: EFFECT_GAIN_CRYSTAL, color: MANA_BLUE },
  ]),
};
