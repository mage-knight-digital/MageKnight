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
} from "../choiceValidators.js";

import {
  validateSkillLearned,
  validateSkillCooldown,
  validateCombatSkillInCombat,
  validateBlockSkillInBlockPhase,
} from "../skillValidators.js";

export const skillValidatorRegistry: ValidatorRegistry = {
  [USE_SKILL_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending,
    validateSkillLearned,
    validateSkillCooldown,
    validateCombatSkillInCombat,
    validateBlockSkillInBlockPhase,
  ],
};
