/**
 * Lightning Storm - Braevalar Skill
 * @module data/skills/braevalar/lightningStorm
 *
 * Once a round: Flip this to gain one blue or green mana token
 * and one blue or red mana token.
 *
 * This skill presents two sequential choices:
 * 1. Choose blue or green mana
 * 2. Choose blue or red mana
 *
 * All four combinations are valid: blue+blue, blue+red, green+blue, green+red.
 */

import type { SkillId } from "@mage-knight/shared";
import { MANA_BLUE, MANA_GREEN, MANA_RED } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { EFFECT_GAIN_MANA } from "../../../types/effectTypes.js";
import { compound, choice } from "../../effectHelpers.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_BRAEVALAR_LIGHTNING_STORM = "braevalar_lightning_storm" as SkillId;

export const lightningStorm: SkillDefinition = {
  id: SKILL_BRAEVALAR_LIGHTNING_STORM,
  name: "Lightning Storm",
  heroId: "braevalar",
  description: "Flip to gain 1 blue/green mana and 1 blue/red mana",
  usageType: SKILL_USAGE_ONCE_PER_ROUND,
  categories: [CATEGORY_SPECIAL],
  effect: compound([
    // First choice: Blue or Green mana token
    choice([
      { type: EFFECT_GAIN_MANA, color: MANA_BLUE },
      { type: EFFECT_GAIN_MANA, color: MANA_GREEN },
    ]),
    // Second choice: Blue or Red mana token
    choice([
      { type: EFFECT_GAIN_MANA, color: MANA_BLUE },
      { type: EFFECT_GAIN_MANA, color: MANA_RED },
    ]),
  ]),
};
