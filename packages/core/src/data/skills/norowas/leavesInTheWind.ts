/**
 * Leaves in the Wind - Norowas Skill
 * @module data/skills/norowas/leavesInTheWind
 *
 * Once a round: Flip this to gain one green crystal to your inventory
 * and one white mana token.
 */

import type { SkillId } from "@mage-knight/shared";
import { MANA_GREEN, MANA_WHITE } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { EFFECT_GAIN_CRYSTAL, EFFECT_GAIN_MANA } from "../../../types/effectTypes.js";
import { compound } from "../../effectHelpers.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_NOROWAS_LEAVES_IN_THE_WIND = "norowas_leaves_in_the_wind" as SkillId;

export const leavesInTheWind: SkillDefinition = {
  id: SKILL_NOROWAS_LEAVES_IN_THE_WIND,
  name: "Leaves in the Wind",
  heroId: "norowas",
  description: "Flip to gain 1 green crystal and 1 white mana token",
  usageType: SKILL_USAGE_ONCE_PER_ROUND,
  categories: [CATEGORY_SPECIAL],
  effect: compound([
    // Gain one green crystal (permanent, to inventory)
    { type: EFFECT_GAIN_CRYSTAL, color: MANA_GREEN },
    // Gain one white mana token (temporary)
    { type: EFFECT_GAIN_MANA, color: MANA_WHITE },
  ]),
};
