/**
 * Skill usage validators
 *
 * Validates that a player can use a skill:
 * - Skill is learned
 * - Skill is not on cooldown
 * - Skill doesn't conflict with an already-active skill
 */

import type { SkillId } from "@mage-knight/shared";
import type { Validator } from "./types.js";
import type { UseSkillAction } from "@mage-knight/shared";
import { valid, invalid } from "./types.js";
import {
  PLAYER_NOT_FOUND,
  SKILL_CONFLICT,
  SKILL_NOT_LEARNED,
  SKILL_NOT_FOUND,
  SKILL_ON_COOLDOWN,
} from "./validationCodes.js";
import {
  SKILLS,
  SKILL_USAGE_ONCE_PER_TURN,
  SKILL_USAGE_ONCE_PER_ROUND,
  SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
  SKILL_TOVAK_WHO_NEEDS_MAGIC,
  SKILL_GOLDYX_UNIVERSAL_POWER,
  SKILL_WOLFHAWK_WOLFS_HOWL,
} from "../../data/skills/index.js";
import { SOURCE_SKILL } from "../../types/modifierConstants.js";

/**
 * Validates that the player has learned the skill they're trying to use.
 */
export const validateSkillLearned: Validator = (state, playerId, action) => {
  const useSkillAction = action as UseSkillAction;
  const player = state.players.find((p) => p.id === playerId);

  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.skills.includes(useSkillAction.skillId)) {
    return invalid(
      SKILL_NOT_LEARNED,
      `Skill ${useSkillAction.skillId} not learned`
    );
  }

  return valid();
};

/**
 * Validates that the skill is not on cooldown.
 */
export const validateSkillCooldown: Validator = (state, playerId, action) => {
  const useSkillAction = action as UseSkillAction;
  const player = state.players.find((p) => p.id === playerId);

  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  const skill = SKILLS[useSkillAction.skillId];
  if (!skill) {
    return invalid(
      SKILL_NOT_FOUND,
      `Skill ${useSkillAction.skillId} not found`
    );
  }

  if (skill.usageType === SKILL_USAGE_ONCE_PER_TURN) {
    if (player.skillCooldowns.usedThisTurn.includes(useSkillAction.skillId)) {
      return invalid(
        SKILL_ON_COOLDOWN,
        `${skill.name} has already been used this turn`
      );
    }
  } else if (skill.usageType === SKILL_USAGE_ONCE_PER_ROUND) {
    if (player.skillCooldowns.usedThisRound.includes(useSkillAction.skillId)) {
      return invalid(
        SKILL_ON_COOLDOWN,
        `${skill.name} has already been used this round`
      );
    }
  }

  return valid();
};

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
 * Validates that the skill doesn't conflict with an already-active skill.
 *
 * Per FAQ S1: I Don't Give a Damn, Universal Power, Who Needs Magic, and Wolf's Howl
 * cannot be used together on the same sideways card.
 *
 * This checks if any of these conflicting skills already have active modifiers
 * from this turn.
 */
export const validateSkillConflict: Validator = (state, playerId, action) => {
  const useSkillAction = action as UseSkillAction;
  const skillId = useSkillAction.skillId;

  // Only check conflict for sideways bonus skills
  if (!SIDEWAYS_BONUS_SKILL_GROUP.includes(skillId)) {
    return valid();
  }

  // Check if any other skill in the group has active modifiers
  const conflictingSkills = SIDEWAYS_BONUS_SKILL_GROUP.filter(
    (s) => s !== skillId
  );

  const hasConflict = state.activeModifiers.some(
    (m) =>
      m.source.type === SOURCE_SKILL &&
      m.source.playerId === playerId &&
      conflictingSkills.includes(m.source.skillId)
  );

  if (hasConflict) {
    const requestedSkill = SKILLS[skillId];
    return invalid(
      SKILL_CONFLICT,
      `Cannot use ${requestedSkill?.name ?? skillId}: another sideways bonus skill is already active this turn`
    );
  }

  return valid();
};
