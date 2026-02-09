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
  NOT_YOUR_TURN,
  WRONG_COMBAT_PHASE,
  SKILL_REQUIRES_NOT_IN_COMBAT,
  SKILL_REQUIRES_WOUND_IN_HAND,
  SKILL_REQUIRES_INTERACTION,
  SKILL_REQUIRES_MANA,
  SKILL_CONFLICTS_WITH_ACTIVE,
  SKILL_NO_VALID_TARGET,
} from "./validationCodes.js";
import {
  SKILLS,
  SKILL_USAGE_ONCE_PER_TURN,
  SKILL_USAGE_ONCE_PER_ROUND,
  SKILL_USAGE_INTERACTIVE,
  SKILL_TOVAK_SHIELD_MASTERY,
  SKILL_TOVAK_I_FEEL_NO_PAIN,
  SKILL_NOROWAS_DAY_SHARPSHOOTING,
  SKILL_TOVAK_NIGHT_SHARPSHOOTING,
  SKILL_ARYTHEA_BURNING_POWER,
  SKILL_ARYTHEA_RITUAL_OF_PAIN,
  SKILL_GOLDYX_FREEZING_POWER,
  SKILL_TOVAK_MANA_OVERLOAD,
  SKILL_NOROWAS_INSPIRATION,
  SKILL_NOROWAS_PRAYER_OF_WEATHER,
  SKILL_GOLDYX_POTION_MAKING,
  SKILL_GOLDYX_GLITTERING_FORTUNE,
  SKILL_GOLDYX_UNIVERSAL_POWER,
  SKILL_GOLDYX_SOURCE_OPENING,
  SKILL_WOLFHAWK_REFRESHING_BATH,
  SKILL_WOLFHAWK_REFRESHING_BREEZE,
  SKILL_WOLFHAWK_DEADLY_AIM,
  SKILL_WOLFHAWK_KNOW_YOUR_PREY,
  SKILL_BRAEVALAR_REGENERATE,
  SKILL_BRAEVALAR_NATURES_VENGEANCE,
} from "../../data/skills/index.js";
import { CATEGORY_COMBAT, CATEGORY_MOVEMENT } from "../../types/cards.js";
import {
  COMBAT_PHASE_ATTACK,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_RANGED_SIEGE,
} from "../../types/combat.js";
import { CARD_WOUND, hexKey } from "@mage-knight/shared";
import { getPlayerById } from "../helpers/playerHelpers.js";
import { canUseMeleeAttackSkill, isMeleeAttackSkill } from "../rules/skillPhasing.js";
import { isPlayerAtInteractionSite } from "../rules/siteInteraction.js";
import { canActivateUniversalPower } from "../commands/skills/universalPowerEffect.js";
import { canActivateKnowYourPrey } from "../commands/skills/knowYourPreyEffect.js";
import { isMotivationSkill, isMotivationCooldownActive } from "../rules/motivation.js";

const INTERACTIVE_ONCE_PER_ROUND = new Set([SKILL_ARYTHEA_RITUAL_OF_PAIN, SKILL_TOVAK_MANA_OVERLOAD, SKILL_NOROWAS_PRAYER_OF_WEATHER, SKILL_GOLDYX_SOURCE_OPENING, SKILL_BRAEVALAR_NATURES_VENGEANCE]);

/**
 * Validates the turn requirement for skill usage.
 * Motivation skills can be used on any player's turn.
 * All other skills require it to be the player's own turn.
 */
export const validateSkillTurnRequirement: Validator = (state, playerId, action) => {
  const useSkillAction = action as UseSkillAction;

  // Motivation skills can be used on any player's turn
  if (isMotivationSkill(useSkillAction.skillId)) {
    return valid();
  }

  // All other skills require it to be the player's turn
  const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
  if (currentPlayerId !== playerId) {
    return invalid(NOT_YOUR_TURN, "It is not your turn");
  }
  return valid();
};

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
  } else if (
    skill.usageType === SKILL_USAGE_ONCE_PER_ROUND ||
    (skill.usageType === SKILL_USAGE_INTERACTIVE &&
      INTERACTIVE_ONCE_PER_ROUND.has(useSkillAction.skillId))
  ) {
    if (player.skillCooldowns.usedThisRound.includes(useSkillAction.skillId)) {
      return invalid(
        SKILL_ON_COOLDOWN,
        `${skill.name} has already been used this round`
      );
    }
  }

  // Motivation cross-hero cooldown: cannot use any Motivation skill
  // while the Motivation cooldown is active (until end of next turn)
  if (isMotivationSkill(useSkillAction.skillId) && isMotivationCooldownActive(player)) {
    return invalid(
      SKILL_ON_COOLDOWN,
      "Cannot use a Motivation skill until the end of your next turn"
    );
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
  // Skills with both CATEGORY_MOVEMENT and CATEGORY_COMBAT (e.g., Spirit Guides)
  // can be used outside combat for their movement effect
  if (skill.categories.includes(CATEGORY_COMBAT)) {
    if (!skill.categories.includes(CATEGORY_MOVEMENT) && !state.combat) {
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
  const rangedSkills = [SKILL_NOROWAS_DAY_SHARPSHOOTING, SKILL_TOVAK_NIGHT_SHARPSHOOTING, SKILL_ARYTHEA_BURNING_POWER, SKILL_GOLDYX_FREEZING_POWER, SKILL_WOLFHAWK_DEADLY_AIM];

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
 * Validates that melee attack skills are only used during the attack phase.
 * These skills differ from ranged/siege attacks which can be used during ranged/siege phase as well.
 * Uses shared rule from rules/skillPhasing.ts to stay aligned with ValidActions.
 */
export const validateMeleeAttackSkillInAttackPhase: Validator = (
  state,
  _playerId,
  action
) => {
  const useSkillAction = action as UseSkillAction;

  if (isMeleeAttackSkill(useSkillAction.skillId)) {
    if (!canUseMeleeAttackSkill(state)) {
      const skill = SKILLS[useSkillAction.skillId];
      return invalid(
        WRONG_COMBAT_PHASE,
        `${skill?.name ?? useSkillAction.skillId} can only be used during the attack phase`
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

  if (useSkillAction.skillId === SKILL_ARYTHEA_RITUAL_OF_PAIN) {
    if (state.combat !== null) {
      return invalid(
        SKILL_REQUIRES_NOT_IN_COMBAT,
        "Ritual of Pain cannot be used during combat"
      );
    }
  }

  if (useSkillAction.skillId === SKILL_NOROWAS_INSPIRATION) {
    if (state.combat !== null) {
      return invalid(
        SKILL_REQUIRES_NOT_IN_COMBAT,
        "Inspiration cannot be used during combat"
      );
    }
  }

  if (useSkillAction.skillId === SKILL_NOROWAS_PRAYER_OF_WEATHER) {
    if (state.combat !== null) {
      return invalid(
        SKILL_REQUIRES_NOT_IN_COMBAT,
        "Prayer of Weather cannot be used during combat"
      );
    }
  }

  if (useSkillAction.skillId === SKILL_GOLDYX_POTION_MAKING) {
    if (state.combat !== null) {
      return invalid(
        SKILL_REQUIRES_NOT_IN_COMBAT,
        "Potion Making cannot be used during combat"
      );
    }
  }

  if (useSkillAction.skillId === SKILL_GOLDYX_SOURCE_OPENING) {
    if (state.combat !== null) {
      return invalid(
        SKILL_REQUIRES_NOT_IN_COMBAT,
        "Source Opening cannot be used during combat"
      );
    }
  }

  if (useSkillAction.skillId === SKILL_WOLFHAWK_REFRESHING_BATH) {
    if (state.combat !== null) {
      return invalid(
        SKILL_REQUIRES_NOT_IN_COMBAT,
        "Refreshing Bath cannot be used during combat"
      );
    }
  }

  if (useSkillAction.skillId === SKILL_WOLFHAWK_REFRESHING_BREEZE) {
    if (state.combat !== null) {
      return invalid(
        SKILL_REQUIRES_NOT_IN_COMBAT,
        "Refreshing Breeze cannot be used during combat"
      );
    }
  }

  if (useSkillAction.skillId === SKILL_GOLDYX_GLITTERING_FORTUNE) {
    if (!player.position) {
      return invalid(
        SKILL_REQUIRES_INTERACTION,
        "Glittering Fortune can only be used during interaction"
      );
    }
    const hex = state.map.hexes[hexKey(player.position)];
    if (!hex?.site || !isPlayerAtInteractionSite(hex.site, playerId)) {
      return invalid(
        SKILL_REQUIRES_INTERACTION,
        "Glittering Fortune can only be used during interaction"
      );
    }
  }

  // Regenerate: requires wound in hand, not in combat, and mana source
  if (useSkillAction.skillId === SKILL_BRAEVALAR_REGENERATE) {
    if (state.combat !== null) {
      return invalid(
        SKILL_REQUIRES_NOT_IN_COMBAT,
        "Regenerate cannot be used during combat"
      );
    }

    if (!player.hand.some((c) => c === CARD_WOUND)) {
      return invalid(
        SKILL_REQUIRES_WOUND_IN_HAND,
        "Regenerate requires a Wound in hand"
      );
    }

    if (!useSkillAction.manaSource) {
      return invalid(
        SKILL_REQUIRES_MANA,
        "Regenerate requires a mana source to spend"
      );
    }
  }

  // Universal Power: requires mana source and no conflicting skills
  if (useSkillAction.skillId === SKILL_GOLDYX_UNIVERSAL_POWER) {
    if (!useSkillAction.manaSource) {
      return invalid(
        SKILL_REQUIRES_MANA,
        "Universal Power requires a mana source to spend"
      );
    }
    if (!canActivateUniversalPower(state, player)) {
      return invalid(
        SKILL_CONFLICTS_WITH_ACTIVE,
        "Universal Power cannot be activated while a conflicting sideways skill is active"
      );
    }
  }

  // Know Your Prey: requires targetable enemies with removable options
  if (useSkillAction.skillId === SKILL_WOLFHAWK_KNOW_YOUR_PREY) {
    if (!canActivateKnowYourPrey(state)) {
      return invalid(
        SKILL_NO_VALID_TARGET,
        "Know Your Prey requires an eligible enemy with removable abilities, resistances, or convertible elements"
      );
    }
  }

  return valid();
};
