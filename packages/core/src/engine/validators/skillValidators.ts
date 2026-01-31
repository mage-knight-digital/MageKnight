/**
 * Skill usage validators
 *
 * Validates USE_SKILL_ACTION against game rules:
 * - Player must own the skill
 * - Skill must have an executable effect
 * - Skill must not be on cooldown
 * - Turn/combat restrictions must be met
 */

import type { Validator } from "./types.js";
import { invalid, valid } from "./types.js";
import { USE_SKILL_ACTION, type UseSkillAction, ROUND_PHASE_TACTICS_SELECTION } from "@mage-knight/shared";
import {
  getSkillDefinition,
  SKILL_USAGE_ONCE_PER_ROUND,
  SKILL_USAGE_ONCE_PER_TURN,
} from "../../data/skills/index.js";
import {
  PLAYER_NOT_FOUND,
  SKILL_NOT_FOUND,
  SKILL_NOT_OWNED,
  SKILL_HAS_NO_EFFECT,
  SKILL_ALREADY_USED_THIS_ROUND,
  SKILL_ALREADY_USED_THIS_TURN,
  SKILL_LOCKED_UNTIL_NEXT_TURN,
  SKILL_NOT_USABLE_IN_COMBAT,
  SKILL_NOT_USABLE_OUT_OF_TURN,
  SKILL_NOT_USABLE_DURING_TACTICS,
} from "./validationCodes.js";

/**
 * Validates that the skill exists in the game data.
 */
export const validateSkillExists: Validator = (state, playerId, action) => {
  if (action.type !== USE_SKILL_ACTION) return valid();

  const skillAction = action as UseSkillAction;
  const skillDef = getSkillDefinition(skillAction.skillId);
  if (!skillDef) {
    return invalid(SKILL_NOT_FOUND, `Skill ${skillAction.skillId} not found`);
  }

  return valid();
};

/**
 * Validates that the player owns the skill they are trying to use.
 */
export const validateSkillOwned: Validator = (state, playerId, action) => {
  if (action.type !== USE_SKILL_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  const skillAction = action as UseSkillAction;
  if (!player.skills.includes(skillAction.skillId)) {
    return invalid(SKILL_NOT_OWNED, "You do not own this skill");
  }

  return valid();
};

/**
 * Validates that the skill has an effect to execute.
 * Passive skills have no effect property and cannot be "used".
 */
export const validateSkillHasEffect: Validator = (state, playerId, action) => {
  if (action.type !== USE_SKILL_ACTION) return valid();

  const skillAction = action as UseSkillAction;
  const skillDef = getSkillDefinition(skillAction.skillId);
  if (!skillDef?.effect) {
    return invalid(SKILL_HAS_NO_EFFECT, "This skill has no active effect");
  }

  return valid();
};

/**
 * Validates that the skill is not on cooldown.
 * Checks usedThisRound, usedThisTurn, and activeUntilNextTurn.
 */
export const validateSkillCooldown: Validator = (state, playerId, action) => {
  if (action.type !== USE_SKILL_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  const skillAction = action as UseSkillAction;
  const skillDef = getSkillDefinition(skillAction.skillId);
  if (!skillDef) {
    return invalid(SKILL_NOT_FOUND, "Skill not found");
  }

  const cooldowns = player.skillCooldowns;

  // Check if skill is locked (used this round, not yet reset)
  if (cooldowns.activeUntilNextTurn.includes(skillAction.skillId)) {
    return invalid(
      SKILL_LOCKED_UNTIL_NEXT_TURN,
      "Skill is locked until the start of your next turn"
    );
  }

  // Check usage type cooldowns
  if (skillDef.usageType === SKILL_USAGE_ONCE_PER_ROUND) {
    if (cooldowns.usedThisRound.includes(skillAction.skillId)) {
      return invalid(
        SKILL_ALREADY_USED_THIS_ROUND,
        "Skill has already been used this round"
      );
    }
  } else if (skillDef.usageType === SKILL_USAGE_ONCE_PER_TURN) {
    if (cooldowns.usedThisTurn.includes(skillAction.skillId)) {
      return invalid(
        SKILL_ALREADY_USED_THIS_TURN,
        "Skill has already been used this turn"
      );
    }
  }

  return valid();
};

/**
 * Validates that the skill can be used in the current combat context.
 * Skills with canUseInCombat=false cannot be used during combat.
 */
export const validateSkillCombatRestriction: Validator = (state, playerId, action) => {
  if (action.type !== USE_SKILL_ACTION) return valid();

  const skillAction = action as UseSkillAction;
  const skillDef = getSkillDefinition(skillAction.skillId);
  if (!skillDef) {
    return invalid(SKILL_NOT_FOUND, "Skill not found");
  }

  const inCombat = state.combat !== null;

  if (inCombat && !skillDef.canUseInCombat) {
    return invalid(
      SKILL_NOT_USABLE_IN_COMBAT,
      "This skill cannot be used during combat"
    );
  }

  return valid();
};

/**
 * Validates turn ownership for skill usage.
 * Most skills require it to be the player's turn.
 * Skills with canUseOutOfTurn=true (like Motivation) can be used on any player's turn.
 */
export const validateSkillTurnRestriction: Validator = (state, playerId, action) => {
  if (action.type !== USE_SKILL_ACTION) return valid();

  const skillAction = action as UseSkillAction;
  const skillDef = getSkillDefinition(skillAction.skillId);
  if (!skillDef) {
    return invalid(SKILL_NOT_FOUND, "Skill not found");
  }

  // Get the current player from turn order
  const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
  const isPlayersTurn = currentPlayerId === playerId;

  // If it's the player's turn, always allowed
  if (isPlayersTurn) return valid();

  // If not player's turn, check if skill allows out-of-turn usage
  if (!skillDef.canUseOutOfTurn) {
    return invalid(
      SKILL_NOT_USABLE_OUT_OF_TURN,
      "This skill can only be used on your turn"
    );
  }

  return valid();
};

/**
 * Validates that the player is not in tactics selection phase.
 * Skills cannot be used before tactic cards are drawn (FAQ S6).
 */
export const validateSkillNotDuringTactics: Validator = (state, playerId, action) => {
  if (action.type !== USE_SKILL_ACTION) return valid();

  if (state.roundPhase === ROUND_PHASE_TACTICS_SELECTION) {
    return invalid(
      SKILL_NOT_USABLE_DURING_TACTICS,
      "Cannot use skills during tactics selection"
    );
  }

  return valid();
};
