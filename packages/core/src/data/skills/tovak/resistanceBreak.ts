/**
 * Resistance Break - Tovak Skill
 *
 * Once per turn: choose an enemy token, it gets Armor -1 for each resistance
 * it has (Physical, Ice, Fire) to a minimum of 1.
 *
 * - Does NOT work against enemies with Arcane Immunity (FAQ S1)
 * - Stacks with Expose when Resistance Break is used first (FAQ S2)
 * - Only counts Physical, Ice, Fire resistances (FAQ S3)
 *
 * @module data/skills/tovak/resistanceBreak
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { EFFECT_SELECT_COMBAT_ENEMY } from "../../../types/effectTypes.js";
import {
  DURATION_COMBAT,
  EFFECT_ENEMY_STAT,
  ENEMY_STAT_ARMOR,
} from "../../../types/modifierConstants.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_TOVAK_RESISTANCE_BREAK = "tovak_resistance_break" as SkillId;

export const resistanceBreak: SkillDefinition = {
  id: SKILL_TOVAK_RESISTANCE_BREAK,
  name: "Resistance Break",
  heroId: "tovak",
  description: "Target enemy: Armor -1 for each resistance it has (min 1)",
  usageType: SKILL_USAGE_ONCE_PER_TURN,
  effect: {
    type: EFFECT_SELECT_COMBAT_ENEMY,
    excludeArcaneImmune: true,
    template: {
      modifiers: [
        {
          modifier: {
            type: EFFECT_ENEMY_STAT,
            stat: ENEMY_STAT_ARMOR,
            amount: -1,
            minimum: 1,
            perResistance: true,
          },
          duration: DURATION_COMBAT,
          description: "Armor -1 per resistance",
        },
      ],
    },
  },
  categories: [CATEGORY_COMBAT],
};
