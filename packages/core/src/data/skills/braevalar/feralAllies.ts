/**
 * Feral Allies - Braevalar Skill
 *
 * Passive: Exploring costs 1 less Move (applies to every tile explored).
 * Active (once per turn): Attack 1 OR reduce one enemy's attack by 1.
 *
 * Key rules:
 * - Passive exploring cost reduction applies for the whole turn, every tile (Q1)
 * - Attack reduction works on Arcane Immune enemies (S2)
 * - Attack reduction is attack modification (happens BEFORE Brutal doubling)
 *
 * @module data/skills/braevalar/feralAllies
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_MOVEMENT, CATEGORY_COMBAT } from "../../../types/cards.js";
import {
  COMBAT_TYPE_MELEE,
  EFFECT_CHOICE,
  EFFECT_GAIN_ATTACK,
  EFFECT_SELECT_COMBAT_ENEMY,
} from "../../../types/effectTypes.js";
import {
  DURATION_COMBAT,
  EFFECT_ENEMY_STAT,
  EFFECT_EXPLORE_COST_REDUCTION,
  ENEMY_STAT_ATTACK,
} from "../../../types/modifierConstants.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_BRAEVALAR_FERAL_ALLIES = "braevalar_feral_allies" as SkillId;

/**
 * Active effect: Choose Attack 1 (physical, melee) OR reduce one enemy's attack by 1.
 * Attack reduction does NOT exclude Arcane Immune enemies (S2).
 */
const feralAlliesEffect = {
  type: EFFECT_CHOICE,
  options: [
    // Option 1: Attack 1 (physical, melee)
    {
      type: EFFECT_GAIN_ATTACK,
      amount: 1,
      combatType: COMBAT_TYPE_MELEE,
    },
    // Option 2: Reduce one enemy's attack by 1
    {
      type: EFFECT_SELECT_COMBAT_ENEMY,
      // Arcane Immune enemies CAN be targeted (S2)
      template: {
        modifiers: [
          {
            modifier: {
              type: EFFECT_ENEMY_STAT,
              stat: ENEMY_STAT_ATTACK,
              amount: -1,
              minimum: 0,
            },
            duration: DURATION_COMBAT,
            description: "Feral Allies: Attack -1",
          },
        ],
      },
    },
  ],
} as const;

export const feralAllies: SkillDefinition = {
  id: SKILL_BRAEVALAR_FERAL_ALLIES,
  name: "Feral Allies",
  heroId: "braevalar",
  description: "Exploring -1 Move. Attack 1 or reduce enemy attack by 1",
  usageType: SKILL_USAGE_ONCE_PER_TURN,
  effect: feralAlliesEffect,
  passiveModifiers: [
    {
      type: EFFECT_EXPLORE_COST_REDUCTION,
      amount: -1,
    },
  ],
  categories: [CATEGORY_MOVEMENT, CATEGORY_COMBAT],
};
