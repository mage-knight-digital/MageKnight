/**
 * Skill action validator registry
 * Handles USE_SKILL_ACTION
 */

import type { Validator } from "../types.js";
import { USE_SKILL_ACTION } from "@mage-knight/shared";

// Turn validators
import { validateIsPlayersTurn, validateRoundPhase } from "../turnValidators.js";

// Choice validators
import { validateNoChoicePending } from "../choiceValidators.js";

// Skill validators
import {
  validateSkillLearned,
  validateSkillCooldown,
  validateCombatSkillInCombat,
  validateBlockSkillInBlockPhase,
  validateSkillRequirements,
} from "../skillValidators.js";

export const skillRegistry: Record<string, Validator[]> = {
  [USE_SKILL_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending,
    validateSkillLearned,
    validateSkillCooldown,
    validateCombatSkillInCombat,
    validateBlockSkillInBlockPhase,
    validateSkillRequirements,
  ],
};
