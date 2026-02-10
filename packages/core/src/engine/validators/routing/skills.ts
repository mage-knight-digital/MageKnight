/**
 * Skills validators routing - USE_SKILL
 */

import type { ValidatorRegistry } from "./types.js";
import { USE_SKILL_ACTION } from "@mage-knight/shared";

import {
  validateIsPlayersTurn,
  validateRoundPhase,
} from "../turnValidators.js";

import {
  validateNoChoicePending,
  validateNoBlockingTacticDecisionPending,
} from "../choiceValidators.js";

import {
  validateSkillLearned,
  validateSkillCooldown,
  validateCombatSkillInCombat,
  validateBlockSkillInBlockPhase,
  validateSkillRequirements,
} from "../skillValidators.js";

export const skillValidatorRegistry: ValidatorRegistry = {
  [USE_SKILL_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending,
    validateNoBlockingTacticDecisionPending, // Must resolve pending tactic decision first
    validateSkillLearned,
    validateSkillCooldown,
    validateCombatSkillInCombat,
    validateBlockSkillInBlockPhase,
    validateSkillRequirements,
  ],
};
