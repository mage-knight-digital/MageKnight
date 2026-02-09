/**
 * Arcane Disguise - Krang Skill
 * @module data/skills/krang/arcaneDisguise
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_INFLUENCE } from "../../../types/cards.js";
import {
  DURATION_TURN,
  EFFECT_RULE_OVERRIDE,
  RULE_IGNORE_REPUTATION,
} from "../../../types/modifierConstants.js";
import {
  EFFECT_APPLY_MODIFIER,
  EFFECT_CHOICE,
  EFFECT_GAIN_INFLUENCE,
} from "../../../types/effectTypes.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_KRANG_ARCANE_DISGUISE = "krang_arcane_disguise" as SkillId;

export const arcaneDisguise: SkillDefinition = {
  id: SKILL_KRANG_ARCANE_DISGUISE,
  name: "Arcane Disguise",
  heroId: "krang",
  description: "Influence 2, or flip to ignore reputation. Green mana to flip back",
  usageType: SKILL_USAGE_ONCE_PER_TURN,
  effect: {
    type: EFFECT_CHOICE,
    options: [
      // Option 0: Influence 2 (stays face-up)
      { type: EFFECT_GAIN_INFLUENCE, amount: 2 },
      // Option 1: Ignore reputation effects this turn (flips face-down in resolveChoice)
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_RULE_OVERRIDE,
          rule: RULE_IGNORE_REPUTATION,
        },
        duration: DURATION_TURN,
        description: "Ignore reputation effects this turn",
      },
    ],
  },
  categories: [CATEGORY_INFLUENCE],
};
