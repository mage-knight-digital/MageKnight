/**
 * Skill usage validators
 *
 * Validates that a player can use a skill:
 * - Skill is learned
 * - Skill is not on cooldown
 * - Combat skills are only usable in combat
 * - Block skills are only usable during block phase
 * - Skill-specific requirements are met
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
  WRONG_COMBAT_PHASE,
  SKILL_REQUIRES_NOT_IN_COMBAT,
  SKILL_REQUIRES_WOUND_IN_HAND,
} from "./validationCodes.js";
import {
  SKILLS,
  SKILL_USAGE_ONCE_PER_TURN,
  SKILL_USAGE_ONCE_PER_ROUND,
  SKILL_TOVAK_SHIELD_MASTERY,
  SKILL_TOVAK_I_FEEL_NO_PAIN,
  SKILL_NOROWAS_DAY_SHARPSHOOTING,
  SKILL_ARYTHEA_BURNING_POWER,
} from "../../data/skills/index.js";
import { CATEGORY_COMBAT } from "../../types/cards.js";
import {
  COMBAT_PHASE_ATTACK,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_RANGED_SIEGE,
} from "../../types/combat.js";
import { CARD_WOUND } from "@mage-knight/shared";
import { getPlayerById } from "../helpers/playerHelpers.js";

/**
 * Validates that the player has learned the skill they're trying to use.
 */
export const validateSkillLearned: Validator = (state, playerId, action) => {
  const useSkillAction = action as UseSkillAction;
  const player = getPlayerById(state, playerId);

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
  const player = getPlayerById(state, playerId);

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

/**
 * Validates that block skills are only used during the block phase.
 * Shield Mastery provides block, so it can only be used in block phase.
 */
export const validateBlockSkillInBlockPhase: Validator = (state, _playerId, action) => {
  const useSkillAction = action as UseSkillAction;

  // Skills that provide block can only be used during block phase
  const blockSkills = [SKILL_TOVAK_SHIELD_MASTERY];

  if (blockSkills.includes(useSkillAction.skillId)) {
    if (!state.combat || state.combat.phase !== COMBAT_PHASE_BLOCK) {
      const skill = SKILLS[useSkillAction.skillId];
      return invalid(
        WRONG_COMBAT_PHASE,
        `${skill?.name ?? useSkillAction.skillId} can only be used during the block phase`
      );
    }
  }

  return valid();
};

/**
 * Validates that ranged/siege attack skills are only used during ranged/siege or attack phase.
 */
export const validateRangedSkillInRangedPhase: Validator = (state, _playerId, action) => {
  const useSkillAction = action as UseSkillAction;

  // Skills that provide ranged/siege attacks can only be used in ranged/siege or attack phase
  const rangedSkills = [SKILL_NOROWAS_DAY_SHARPSHOOTING, SKILL_ARYTHEA_BURNING_POWER];

  if (rangedSkills.includes(useSkillAction.skillId)) {
    if (
      !state.combat ||
      (state.combat.phase !== COMBAT_PHASE_RANGED_SIEGE &&
        state.combat.phase !== COMBAT_PHASE_ATTACK)
    ) {
      const skill = SKILLS[useSkillAction.skillId];
      return invalid(
        WRONG_COMBAT_PHASE,
        `${skill?.name ?? useSkillAction.skillId} can only be used during the ranged/siege or attack phase`
      );
    }
  }

  return valid();
};

/**
 * Validates skill-specific requirements.
 * Some skills have additional conditions beyond cooldowns.
 */
export const validateSkillRequirements: Validator = (
  state,
  playerId,
  action
) => {
  const useSkillAction = action as UseSkillAction;
  const player = getPlayerById(state, playerId);

  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  // I Feel No Pain: requires not in combat and wound in hand
  if (useSkillAction.skillId === SKILL_TOVAK_I_FEEL_NO_PAIN) {
    if (state.combat !== null) {
      return invalid(
        SKILL_REQUIRES_NOT_IN_COMBAT,
        "I Feel No Pain cannot be used during combat"
      );
    }

    if (!player.hand.some((c) => c === CARD_WOUND)) {
      return invalid(
        SKILL_REQUIRES_WOUND_IN_HAND,
        "I Feel No Pain requires a Wound in hand"
      );
    }
  }

  return valid();
};
