/**
 * Skill usage validators
 *
 * Validates that a player can use a skill:
 * - Skill is learned
 * - Skill is not on cooldown
 * - Combat skills are only usable in combat
 */

import type { Validator } from "./types.js";
import type { UseSkillAction } from "@mage-knight/shared";
import { valid, invalid } from "./types.js";
import {
  PLAYER_NOT_FOUND,
  SKILL_NOT_LEARNED,
  SKILL_NOT_FOUND,
  SKILL_ON_COOLDOWN,
  NOT_IN_COMBAT,
} from "./validationCodes.js";
import {
  SKILLS,
  SKILL_USAGE_ONCE_PER_TURN,
  SKILL_USAGE_ONCE_PER_ROUND,
} from "../../data/skills/index.js";
import { CATEGORY_COMBAT } from "../../types/cards.js";

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
 * Validates that combat-only skills (CATEGORY_COMBAT) are only used during combat.
 */
export const validateCombatSkillInCombat: Validator = (state, _playerId, action) => {
  const useSkillAction = action as UseSkillAction;

  const skill = SKILLS[useSkillAction.skillId];
  if (!skill) {
    // Let other validators handle missing skills
    return valid();
  }

  // Check if skill is combat-only
  if (skill.categories.includes(CATEGORY_COMBAT)) {
    // Must be in combat to use combat skills
    if (!state.combat) {
      return invalid(
        NOT_IN_COMBAT,
        `${skill.name} can only be used during combat`
      );
    }
  }

  return valid();
};
