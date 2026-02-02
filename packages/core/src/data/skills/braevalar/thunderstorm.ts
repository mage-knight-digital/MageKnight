/**
 * Thunderstorm - Braevalar Skill
 * @module data/skills/braevalar/thunderstorm
 *
 * Once a round: Flip this to gain one green or blue mana token
 * and one green or white mana token.
 *
 * This skill presents two sequential choices:
 * 1. Choose green or blue mana
 * 2. Choose green or white mana
 *
 * All four combinations are valid: green+green, green+white, blue+green, blue+white.
 */

import type { SkillId } from "@mage-knight/shared";
import { MANA_GREEN, MANA_BLUE, MANA_WHITE } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { EFFECT_GAIN_MANA } from "../../../types/effectTypes.js";
import { compound, choice } from "../../effectHelpers.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_BRAEVALAR_THUNDERSTORM = "braevalar_thunderstorm" as SkillId;

export const thunderstorm: SkillDefinition = {
  id: SKILL_BRAEVALAR_THUNDERSTORM,
  name: "Thunderstorm",
  heroId: "braevalar",
  description: "Flip to gain 1 green/blue mana and 1 green/white mana",
  usageType: SKILL_USAGE_ONCE_PER_ROUND,
  categories: [CATEGORY_SPECIAL],
  effect: compound([
    // First choice: Green or Blue mana token
    choice([
      { type: EFFECT_GAIN_MANA, color: MANA_GREEN },
      { type: EFFECT_GAIN_MANA, color: MANA_BLUE },
    ]),
    // Second choice: Green or White mana token
    choice([
      { type: EFFECT_GAIN_MANA, color: MANA_GREEN },
      { type: EFFECT_GAIN_MANA, color: MANA_WHITE },
    ]),
  ]),
};
