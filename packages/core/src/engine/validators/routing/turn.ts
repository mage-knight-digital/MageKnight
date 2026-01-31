/**
 * Turn management validators routing - END_TURN, UNDO, ANNOUNCE_END_OF_ROUND
 */

import type { ValidatorRegistry } from "./types.js";
import {
  END_TURN_ACTION,
  UNDO_ACTION,
  ANNOUNCE_END_OF_ROUND_ACTION,
} from "@mage-knight/shared";

import {
  validateIsPlayersTurn,
  validateRoundPhase,
  validateNotInCombat,
  validateMinimumTurnRequirement,
} from "../turnValidators.js";

import {
  validateNoChoicePending,
  validateNoTacticDecisionPending,
} from "../choiceValidators.js";

import {
  validateNoPendingRewards,
} from "../rewardValidators.js";

import {
  validateNoPendingLevelUpRewards,
} from "../levelUpValidators.js";

import {
  validateDeckEmpty,
  validateRoundEndNotAnnounced,
} from "../roundValidators.js";

import {
  validateRestCompleted,
} from "../restValidators.js";

export const turnValidatorRegistry: ValidatorRegistry = {
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
  [ANNOUNCE_END_OF_ROUND_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending,
    validateDeckEmpty,
    validateRoundEndNotAnnounced,
  ],
};
