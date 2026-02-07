/**
 * Whispers in the Treetops - Norowas Skill
 * @module data/skills/norowas/whispersInTheTreetops
 *
 * Once a round: Flip this to gain one white crystal to your inventory
 * and one green mana token.
 */

import type { SkillId } from "@mage-knight/shared";
import { MANA_GREEN, MANA_WHITE } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { EFFECT_GAIN_CRYSTAL, EFFECT_GAIN_MANA } from "../../../types/effectTypes.js";
import { compound } from "../../effectHelpers.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS = "norowas_whispers_in_the_treetops" as SkillId;

export const whispersInTheTreetops: SkillDefinition = {
  id: SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS,
  name: "Whispers in the Treetops",
  heroId: "norowas",
  description: "Flip to gain 1 white crystal and 1 green mana token",
  usageType: SKILL_USAGE_ONCE_PER_ROUND,
  categories: [CATEGORY_SPECIAL],
  effect: compound([
    // Gain one white crystal (permanent, to inventory)
    { type: EFFECT_GAIN_CRYSTAL, color: MANA_WHITE },
    // Gain one green mana token (temporary)
    { type: EFFECT_GAIN_MANA, color: MANA_GREEN },
  ]),
};
