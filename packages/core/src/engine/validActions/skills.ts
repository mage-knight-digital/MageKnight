/**
 * Valid actions for skill activation.
 *
 * Computes which skills a player can activate based on:
 * - Skills they have learned
 * - Skill cooldowns (once per turn, once per round)
 * - Skill usage type (only activatable skills, not passive/interactive)
 * - Skill conflicts (e.g., sideways bonus skills can't be used together)
 */

import type { SkillId } from "@mage-knight/shared";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { SkillOptions } from "@mage-knight/shared";
import {
  SKILLS,
  SKILL_USAGE_ONCE_PER_TURN,
  SKILL_USAGE_ONCE_PER_ROUND,
  SKILL_GOLDYX_UNIVERSAL_POWER,
  SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
  SKILL_TOVAK_WHO_NEEDS_MAGIC,
  SKILL_WOLFHAWK_WOLFS_HOWL,
} from "../../data/skills/index.js";
import { SOURCE_SKILL } from "../../types/modifierConstants.js";

/**
 * Skills that have effect implementations and can be activated.
 * As more skills are implemented, add them here.
 */
const IMPLEMENTED_SKILLS = new Set([
  SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
  SKILL_TOVAK_WHO_NEEDS_MAGIC,
]);

/**
 * Skills that cannot be used together on the same sideways card.
 * Per FAQ S1: I Don't Give a Damn, Universal Power, Who Needs Magic, and Wolf's Howl
 * cannot be used together on the same sideways card.
 */
const SIDEWAYS_BONUS_SKILL_GROUP: readonly SkillId[] = [
  SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
  SKILL_TOVAK_WHO_NEEDS_MAGIC,
  SKILL_GOLDYX_UNIVERSAL_POWER,
  SKILL_WOLFHAWK_WOLFS_HOWL,
];

/**
 * Check if a skill has an active conflicting skill from the same group.
 */
function hasConflictingSkillActive(
  state: GameState,
  playerId: string,
  skillId: SkillId
): boolean {
  // Only check conflict for sideways bonus skills
  if (!SIDEWAYS_BONUS_SKILL_GROUP.includes(skillId)) {
    return false;
  }

  // Check if any other skill in the group has active modifiers
  const conflictingSkills = SIDEWAYS_BONUS_SKILL_GROUP.filter(
    (s) => s !== skillId
  );

  return state.activeModifiers.some(
    (m) =>
      m.source.type === SOURCE_SKILL &&
      m.source.playerId === playerId &&
      conflictingSkills.includes(m.source.skillId)
  );
}

/**
 * Get skill activation options for a player.
 *
 * Returns undefined if no skills can be activated.
 */
export function getSkillOptions(
  state: GameState,
  player: Player
): SkillOptions | undefined {
  const activatable = [];

  for (const skillId of player.skills) {
    const skill = SKILLS[skillId];
    if (!skill) continue;

    // Only include skills that have been implemented
    if (!IMPLEMENTED_SKILLS.has(skillId)) continue;

    // Check if skill can be activated based on usage type
    if (skill.usageType === SKILL_USAGE_ONCE_PER_TURN) {
      // Check turn cooldown
      if (player.skillCooldowns.usedThisTurn.includes(skillId)) {
        continue;
      }
    } else if (skill.usageType === SKILL_USAGE_ONCE_PER_ROUND) {
      // Check round cooldown
      if (player.skillCooldowns.usedThisRound.includes(skillId)) {
        continue;
      }
    } else {
      // Passive and interactive skills are not directly activatable via USE_SKILL
      continue;
    }

    // Check for skill conflicts (e.g., sideways bonus skills can't stack)
    if (hasConflictingSkillActive(state, player.id, skillId)) {
      continue;
    }

    activatable.push({
      skillId,
      name: skill.name,
      description: skill.description,
    });
  }

  if (activatable.length === 0) {
    return undefined;
  }

  return { activatable };
}
