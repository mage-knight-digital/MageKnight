/**
 * Dueling - Wolfhawk Skill
 *
 * Once per turn, during Block Phase:
 * Block 1. Attack 1 versus the same enemy in the Attack phase.
 * If you do not use any unit ability to block, attack or affect this enemy
 * nor assign damage from it to any unit, you gain 1 more Fame for defeating it.
 *
 * Key rules:
 * - Block Phase only - enemy must be alive and attacking (S1, S4)
 * - Block 1 doesn't need to successfully block to qualify for Attack 1 or Fame (S1)
 * - Unit resistance absorption still counts as unit involvement (S3)
 * - Can't use if enemy prevented from attacking (Whirlwind/Chill) (S4)
 * - CAN use if attack reduced to 0 by Swift Reflexes (S4)
 *
 * @module data/skills/wolfhawk/dueling
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_WOLFHAWK_DUELING = "wolfhawk_dueling" as SkillId;

export const dueling: SkillDefinition = {
  id: SKILL_WOLFHAWK_DUELING,
  name: "Dueling",
  heroId: "wolfhawk",
  description: "Block 1 and Attack 1 vs same enemy. +1 Fame without Units",
  usageType: SKILL_USAGE_ONCE_PER_TURN,
  categories: [CATEGORY_COMBAT],
};
