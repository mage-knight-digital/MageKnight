/**
 * Shared Motivation skill rules.
 *
 * Motivation skills share a cross-hero cooldown: after using any Motivation
 * skill, you cannot use another Motivation skill until the end of your next turn.
 *
 * These helpers are used by both validators and ValidActions computation
 * to prevent rule drift.
 */

import type { SkillId } from "@mage-knight/shared";
import type { Player } from "../../types/player.js";
import {
  SKILL_ARYTHEA_MOTIVATION,
  SKILL_TOVAK_MOTIVATION,
  SKILL_NOROWAS_MOTIVATION,
  SKILL_GOLDYX_MOTIVATION,
} from "../../data/skills/index.js";

/**
 * All Motivation skill IDs across heroes.
 * Used for cross-hero cooldown enforcement.
 */
export const ALL_MOTIVATION_SKILLS: readonly SkillId[] = [
  SKILL_ARYTHEA_MOTIVATION,
  SKILL_TOVAK_MOTIVATION,
  SKILL_NOROWAS_MOTIVATION,
  SKILL_GOLDYX_MOTIVATION,
];

/**
 * Check if a skill is a Motivation skill.
 */
export function isMotivationSkill(skillId: SkillId): boolean {
  return (ALL_MOTIVATION_SKILLS as readonly string[]).includes(skillId);
}

/**
 * Check if the Motivation cooldown is active for a player.
 * Returns true if any Motivation skill is in the activeUntilNextTurn cooldown.
 */
export function isMotivationCooldownActive(player: Player): boolean {
  return player.skillCooldowns.activeUntilNextTurn.some((id) =>
    isMotivationSkill(id)
  );
}
