/**
 * Skill action validator registry
 * Handles USE_SKILL_ACTION and RETURN_INTERACTIVE_SKILL_ACTION
 */

import type { Validator } from "../types.js";
import { USE_SKILL_ACTION, RETURN_INTERACTIVE_SKILL_ACTION } from "@mage-knight/shared";

// Turn validators
import { validateIsPlayersTurn, validateRoundPhase } from "../turnValidators.js";

// Choice validators
import { validateNoChoicePending } from "../choiceValidators.js";

// Skill validators
import {
  validateSkillTurnRequirement,
  validateSkillLearned,
  validateSkillCooldown,
  validateSkillFaceUp,
  validateCombatSkillInCombat,
  validateBlockSkillInBlockPhase,
  validateRangedSkillInRangedPhase,
  validateMeleeAttackSkillInAttackPhase,
  validateSkillRequirements,
} from "../skillValidators.js";

// Return interactive skill validators
import {
  validateSkillInCenter,
  validateNotOwnSkill,
} from "../returnInteractiveSkillValidators.js";

export const skillRegistry: Record<string, Validator[]> = {
  [USE_SKILL_ACTION]: [
    validateSkillTurnRequirement,
    validateRoundPhase,
    validateNoChoicePending,
    validateSkillLearned,
    validateSkillCooldown,
    validateSkillFaceUp,
    validateCombatSkillInCombat,
    validateBlockSkillInBlockPhase,
    validateRangedSkillInRangedPhase,
    validateMeleeAttackSkillInAttackPhase,
    validateSkillRequirements,
  ],
  [RETURN_INTERACTIVE_SKILL_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending,
    validateSkillInCenter,
    validateNotOwnSkill,
  ],
};
