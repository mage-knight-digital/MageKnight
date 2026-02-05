/**
 * Dark Fire Magic - Arythea Skill
 * @module data/skills/arythea/darkFireMagic
 *
 * Once a round: Flip this to gain one red crystal to your inventory,
 * and one red or black mana token.
 *
 * The black mana follows normal day/night rules - can't use it directly
 * during day unless in Dungeon/Tomb or converted via Polarization.
 */

import type { SkillId } from "@mage-knight/shared";
import { MANA_RED, MANA_BLACK } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { EFFECT_GAIN_CRYSTAL, EFFECT_GAIN_MANA } from "../../../types/effectTypes.js";
import { compound, choice } from "../../effectHelpers.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_ARYTHEA_DARK_FIRE_MAGIC = "arythea_dark_fire_magic" as SkillId;

export const darkFireMagic: SkillDefinition = {
  id: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
  name: "Dark Fire Magic",
  heroId: "arythea",
  description: "Flip to gain 1 red crystal and 1 red or black mana token",
  usageType: SKILL_USAGE_ONCE_PER_ROUND,
  categories: [CATEGORY_SPECIAL],
  effect: compound([
    // Gain one red crystal (permanent, to inventory)
    { type: EFFECT_GAIN_CRYSTAL, color: MANA_RED },
    // Choose one: red or black mana token
    choice([
      { type: EFFECT_GAIN_MANA, color: MANA_RED },
      { type: EFFECT_GAIN_MANA, color: MANA_BLACK },
    ]),
  ]),
};
