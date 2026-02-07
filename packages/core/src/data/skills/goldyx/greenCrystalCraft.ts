/**
 * Green Crystal Craft - Goldyx Skill
 * @module data/skills/goldyx/greenCrystalCraft
 *
 * Once a round: Flip this to gain one blue crystal to your inventory
 * and one green mana token.
 */

import type { SkillId } from "@mage-knight/shared";
import { MANA_BLUE, MANA_GREEN } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { EFFECT_GAIN_CRYSTAL, EFFECT_GAIN_MANA } from "../../../types/effectTypes.js";
import { compound } from "../../effectHelpers.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_GOLDYX_GREEN_CRYSTAL_CRAFT = "goldyx_green_crystal_craft" as SkillId;

export const greenCrystalCraft: SkillDefinition = {
  id: SKILL_GOLDYX_GREEN_CRYSTAL_CRAFT,
  name: "Green Crystal Craft",
  heroId: "goldyx",
  description: "Flip to gain 1 blue crystal and 1 green mana token",
  usageType: SKILL_USAGE_ONCE_PER_ROUND,
  categories: [CATEGORY_SPECIAL],
  effect: compound([
    // Gain one blue crystal (permanent, to inventory)
    { type: EFFECT_GAIN_CRYSTAL, color: MANA_BLUE },
    // Gain one green mana token (temporary)
    { type: EFFECT_GAIN_MANA, color: MANA_GREEN },
  ]),
};
