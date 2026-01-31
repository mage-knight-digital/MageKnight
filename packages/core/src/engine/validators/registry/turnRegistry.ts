/**
 * Turn action validator registry
 * Handles END_TURN_ACTION and UNDO_ACTION
 */

import type { Validator } from "../types.js";
import { END_TURN_ACTION, UNDO_ACTION } from "@mage-knight/shared";

// Turn validators
import {
  validateIsPlayersTurn,
  validateRoundPhase,
  validateNotInCombat,
  validateMinimumTurnRequirement,
} from "../turnValidators.js";

// Choice validators
import {
  validateNoChoicePending,
  validateNoTacticDecisionPending,
} from "../choiceValidators.js";

// Rest validators
import { validateRestCompleted } from "../restValidators.js";

// Reward validators
import { validateNoPendingRewards } from "../rewardValidators.js";

// Level up validators
import { validateNoPendingLevelUpRewards } from "../levelUpValidators.js";

export const turnRegistry: Record<string, Validator[]> = {
  [UNDO_ACTION]: [
    validateIsPlayersTurn,
    // Undo has special handling, minimal validation
  ],
  [END_TURN_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending, // Must resolve pending choice first
    validateNoTacticDecisionPending, // Must resolve pending tactic decision first
    validateNoPendingRewards, // Must select rewards before ending turn
    validateNoPendingLevelUpRewards, // Must select level up rewards before ending turn
    validateRestCompleted, // Must complete rest if resting
    validateMinimumTurnRequirement, // Must play or discard at least one card from hand
  ],
};
