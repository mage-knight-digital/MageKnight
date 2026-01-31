/**
 * Validators for USE_SKILL_ACTION
 *
 * Validates skill activation for skills like Dark Fire Magic (Arythea).
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction, SkillId, UseSkillAction } from "@mage-knight/shared";
import { USE_SKILL_ACTION } from "@mage-knight/shared";
import type { ValidationResult } from "./types.js";
import { valid, invalid } from "./types.js";
import {
  SKILL_NOT_OWNED,
  SKILL_ON_COOLDOWN,
  SKILL_IS_PASSIVE,
  SKILL_NO_EFFECT,
  SKILL_NOT_FOUND,
  PLAYER_NOT_FOUND,
  INVALID_ACTION_CODE,
} from "./validationCodes.js";
import {
  getSkillDefinition,
  SKILL_USAGE_PASSIVE,
  SKILL_USAGE_ONCE_PER_ROUND,
  SKILL_USAGE_ONCE_PER_TURN,
} from "../../data/skills/index.js";

/**
 * Type guard to extract skill ID from action.
 */
function getSkillIdFromAction(action: PlayerAction): SkillId | null {
  if (action.type === USE_SKILL_ACTION && "skillId" in action) {
    return (action as UseSkillAction).skillId;
  }
  return null;
}

/**
 * Validates that the player owns the skill.
 */
export function validateSkillOwned(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  const skillId = getSkillIdFromAction(action);
  if (!skillId) {
    return invalid(INVALID_ACTION_CODE, "Invalid skill action");
  }

  if (!player.skills.includes(skillId)) {
    return invalid(SKILL_NOT_OWNED, "Player does not own this skill");
  }

  return valid();
}

/**
 * Validates that the skill exists.
 */
export function validateSkillExists(
  _state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  const skillId = getSkillIdFromAction(action);
  if (!skillId) {
    return invalid(INVALID_ACTION_CODE, "Invalid skill action");
  }

  const skillDef = getSkillDefinition(skillId);
  if (!skillDef) {
    return invalid(SKILL_NOT_FOUND, "Skill not found");
  }

  return valid();
}

/**
 * Validates that the skill is not passive (passive skills cannot be activated).
 */
export function validateSkillNotPassive(
  _state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  const skillId = getSkillIdFromAction(action);
  if (!skillId) {
    return invalid(INVALID_ACTION_CODE, "Invalid skill action");
  }

  const skillDef = getSkillDefinition(skillId);
  if (!skillDef) {
    return invalid(SKILL_NOT_FOUND, "Skill not found");
  }

  if (skillDef.usageType === SKILL_USAGE_PASSIVE) {
    return invalid(SKILL_IS_PASSIVE, "Passive skills cannot be activated");
  }

  return valid();
}

/**
 * Validates that the skill has an effect implemented.
 */
export function validateSkillHasEffect(
  _state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  const skillId = getSkillIdFromAction(action);
  if (!skillId) {
    return invalid(INVALID_ACTION_CODE, "Invalid skill action");
  }

  const skillDef = getSkillDefinition(skillId);
  if (!skillDef) {
    return invalid(SKILL_NOT_FOUND, "Skill not found");
  }

  if (!skillDef.effect) {
    return invalid(SKILL_NO_EFFECT, "Skill has no effect implemented");
  }

  return valid();
}

/**
 * Validates that the skill is not on cooldown.
 */
export function validateSkillNotOnCooldown(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  const skillId = getSkillIdFromAction(action);
  if (!skillId) {
    return invalid(INVALID_ACTION_CODE, "Invalid skill action");
  }

  const skillDef = getSkillDefinition(skillId);
  if (!skillDef) {
    return invalid(SKILL_NOT_FOUND, "Skill not found");
  }

  // Check cooldowns based on usage type
  if (skillDef.usageType === SKILL_USAGE_ONCE_PER_ROUND) {
    if (player.skillCooldowns.usedThisRound.includes(skillId)) {
      return invalid(SKILL_ON_COOLDOWN, "Skill is on cooldown (used this round)");
    }
  } else if (skillDef.usageType === SKILL_USAGE_ONCE_PER_TURN) {
    if (player.skillCooldowns.usedThisTurn.includes(skillId)) {
      return invalid(SKILL_ON_COOLDOWN, "Skill is on cooldown (used this turn)");
    }
  }

  return valid();
}
