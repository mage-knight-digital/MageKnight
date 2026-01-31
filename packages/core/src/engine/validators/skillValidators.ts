/**
 * Skill Usage Validators
 *
 * Validates skill activation actions.
 *
 * @module validators/skillValidators
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction, SkillId } from "@mage-knight/shared";
import type { ValidationResult } from "./types.js";
import { valid, invalid } from "./types.js";
import { USE_SKILL_ACTION } from "@mage-knight/shared";
import {
  getSkillDefinition,
  SKILL_USAGE_ONCE_PER_TURN,
  SKILL_USAGE_ONCE_PER_ROUND,
  SKILL_ARYTHEA_POWER_OF_PAIN,
} from "../../data/skills/index.js";
import { canActivatePowerOfPain } from "../commands/skills/powerOfPain.js";
import {
  SKILL_NOT_OWNED,
  SKILL_ON_COOLDOWN,
  SKILL_PRECONDITION_FAILED,
  INVALID_ACTION_CODE,
  PLAYER_NOT_FOUND,
} from "./validationCodes.js";

/**
 * Extract skill ID from action.
 */
function getSkillIdFromAction(action: PlayerAction): SkillId | null {
  if (action.type === USE_SKILL_ACTION && "skillId" in action) {
    return action.skillId as SkillId;
  }
  return null;
}

/**
 * Validate that the player owns the skill.
 */
export function validateSkillOwned(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  const skillId = getSkillIdFromAction(action);
  if (!skillId) {
    return invalid(INVALID_ACTION_CODE, "Invalid skill action");
  }

  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.skills.includes(skillId)) {
    return invalid(SKILL_NOT_OWNED, "You do not own this skill");
  }

  return valid();
}

/**
 * Validate that the skill is not on cooldown.
 */
export function validateSkillNotOnCooldown(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  const skillId = getSkillIdFromAction(action);
  if (!skillId) {
    return invalid(INVALID_ACTION_CODE, "Invalid skill action");
  }

  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  const skillDef = getSkillDefinition(skillId);
  if (!skillDef) {
    return invalid(INVALID_ACTION_CODE, "Unknown skill");
  }

  const cooldowns = player.skillCooldowns;

  // Check cooldown based on usage type
  switch (skillDef.usageType) {
    case SKILL_USAGE_ONCE_PER_TURN:
      if (cooldowns.usedThisTurn.includes(skillId)) {
        return invalid(SKILL_ON_COOLDOWN, "Skill already used this turn");
      }
      break;

    case SKILL_USAGE_ONCE_PER_ROUND:
      if (cooldowns.usedThisRound.includes(skillId)) {
        return invalid(SKILL_ON_COOLDOWN, "Skill already used this round");
      }
      break;

    // Passive and interactive skills have different activation patterns
    // and are not validated here
  }

  return valid();
}

/**
 * Validate skill-specific preconditions.
 *
 * Each skill may have unique preconditions (e.g., must have wound in hand).
 */
export function validateSkillPreconditions(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  const skillId = getSkillIdFromAction(action);
  if (!skillId) {
    return invalid(INVALID_ACTION_CODE, "Invalid skill action");
  }

  // Dispatch to skill-specific precondition checks
  if (skillId === SKILL_ARYTHEA_POWER_OF_PAIN) {
    if (!canActivatePowerOfPain(state, playerId)) {
      return invalid(
        SKILL_PRECONDITION_FAILED,
        "Power of Pain requires at least one Wound in hand"
      );
    }
  }

  // Future: add more skill-specific precondition checks here

  return valid();
}

/**
 * All skill validators.
 */
export const skillValidators = [
  validateSkillOwned,
  validateSkillNotOnCooldown,
  validateSkillPreconditions,
];
