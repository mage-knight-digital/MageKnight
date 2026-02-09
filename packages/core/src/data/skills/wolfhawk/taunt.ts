/**
 * Taunt - Wolfhawk Skill
 *
 * Once per turn, during Block Phase:
 * Option 1: Reduce one enemy's attack by 1
 * Option 2: Increase one enemy's attack by 2 AND reduce its armor by 2 (min 1)
 *
 * Key rules:
 * - Block Phase only (Q3/A3)
 * - Armor reduction only happens if enemy actually attacks (Q4/A4)
 * - CAN reduce attack of Arcane Immune enemies (Q1/A1)
 * - CANNOT reduce armor of Arcane Immune enemies (Q1/A1)
 * - Attack reduction is attack modification (affects Brutal doubling)
 *
 * @module data/skills/wolfhawk/taunt
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { EFFECT_CHOICE } from "../../../types/effectTypes.js";
import { EFFECT_SELECT_COMBAT_ENEMY } from "../../../types/effectTypes.js";
import {
  DURATION_COMBAT,
  EFFECT_ENEMY_STAT,
  ENEMY_STAT_ARMOR,
  ENEMY_STAT_ATTACK,
} from "../../../types/modifierConstants.js";
import { COMBAT_PHASE_BLOCK } from "../../../types/combat.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_WOLFHAWK_TAUNT = "wolfhawk_taunt" as SkillId;

export const taunt: SkillDefinition = {
  id: SKILL_WOLFHAWK_TAUNT,
  name: "Taunt",
  heroId: "wolfhawk",
  description: "Block phase: Enemy attack -1, OR +2 attack but armor -2",
  usageType: SKILL_USAGE_ONCE_PER_TURN,
  effect: {
    type: EFFECT_CHOICE,
    options: [
      // Option 1: Reduce one enemy's attack by 1
      {
        type: EFFECT_SELECT_COMBAT_ENEMY,
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
              description: "Taunt: Attack -1",
            },
          ],
        },
        requiredPhase: COMBAT_PHASE_BLOCK,
      },
      // Option 2: Increase attack by 2, reduce armor by 2 (conditional)
      {
        type: EFFECT_SELECT_COMBAT_ENEMY,
        template: {
          modifiers: [
            {
              modifier: {
                type: EFFECT_ENEMY_STAT,
                stat: ENEMY_STAT_ATTACK,
                amount: 2,
                minimum: 0,
              },
              duration: DURATION_COMBAT,
              description: "Taunt: Attack +2",
            },
            {
              modifier: {
                type: EFFECT_ENEMY_STAT,
                stat: ENEMY_STAT_ARMOR,
                amount: -2,
                minimum: 1,
                onlyIfEnemyAttacks: true,
              },
              duration: DURATION_COMBAT,
              description: "Taunt: Armor -2",
            },
          ],
        },
        requiredPhase: COMBAT_PHASE_BLOCK,
      },
    ],
  },
  categories: [CATEGORY_COMBAT],
};
