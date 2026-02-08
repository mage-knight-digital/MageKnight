/**
 * Spirit Guides - Krang Skill
 * @module data/skills/krang/spiritGuides
 *
 * Once a turn: Move 1 and you may add +1 to a Block of any type in the Block phase.
 *
 * FAQ Rulings:
 * - S1: +1 applies to any block source (cards, skills, units)
 * - S2: Works with Diplomacy's Influence-to-Block conversion (including elemental)
 * - S3: Move point is immediate; +1 Block persists throughout Block phase
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_MOVEMENT, CATEGORY_COMBAT } from "../../../types/cards.js";
import { EFFECT_COMPOUND, EFFECT_APPLY_MODIFIER, EFFECT_GAIN_MOVE } from "../../../types/effectTypes.js";
import { EFFECT_COMBAT_VALUE, COMBAT_VALUE_BLOCK, DURATION_TURN, SCOPE_SELF } from "../../../types/modifierConstants.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_KRANG_SPIRIT_GUIDES = "krang_spirit_guides" as SkillId;

export const spiritGuides: SkillDefinition = {
  id: SKILL_KRANG_SPIRIT_GUIDES,
  name: "Spirit Guides",
  heroId: "krang",
  description: "Move 1 and may add +1 to a Block",
  usageType: SKILL_USAGE_ONCE_PER_TURN,
  categories: [CATEGORY_MOVEMENT, CATEGORY_COMBAT],
  effect: {
    type: EFFECT_COMPOUND,
    effects: [
      { type: EFFECT_GAIN_MOVE, amount: 1 },
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_COMBAT_VALUE,
          valueType: COMBAT_VALUE_BLOCK,
          amount: 1,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        description: "Spirit Guides +1 Block",
      },
    ],
  },
};
