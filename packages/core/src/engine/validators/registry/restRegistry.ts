/**
 * Rest action validator registry
 * Handles REST_ACTION, DECLARE_REST_ACTION, and COMPLETE_REST_ACTION
 */

import type { Validator } from "../types.js";
import {
  REST_ACTION,
  DECLARE_REST_ACTION,
  COMPLETE_REST_ACTION,
} from "@mage-knight/shared";

// Turn validators
import {
  validateIsPlayersTurn,
  validateRoundPhase,
  validateNotInCombat,
  validateHasNotActed,
} from "../turnValidators.js";

// Choice validators
import { validateNoChoicePending } from "../choiceValidators.js";

// Rest validators
import {
  validateRestHasDiscard,
  validateRestCardsInHand,
  validateStandardRest,
  validateSlowRecovery,
  // Two-phase rest validators
  validateNotAlreadyResting,
  validateNotMovedForRest,
  validateIsResting,
  validateCompleteRestDiscard,
} from "../restValidators.js";

// Round validators
import { validateMustAnnounceEndOfRound } from "../roundValidators.js";

// Level up validators
import { validateNoPendingLevelUpRewards } from "../levelUpValidators.js";

export const restRegistry: Record<string, Validator[]> = {
  // Legacy REST_ACTION - kept for backward compatibility
  [REST_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending,
    validateNoPendingLevelUpRewards, // Must select level up rewards first
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    validateHasNotActed, // Can only rest if you haven't taken an action
    validateRestHasDiscard,
    validateRestCardsInHand,
    validateStandardRest, // Checks standard rest rules (exactly one non-wound)
    validateSlowRecovery, // Checks slow recovery rules (all wounds in hand)
  ],
  // NEW: Two-phase rest (per FAQ p.30)
  [DECLARE_REST_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending,
    validateNoPendingLevelUpRewards,
    validateMustAnnounceEndOfRound,
    validateHasNotActed, // Can only declare rest if haven't taken action
    validateNotMovedForRest, // Can't rest after moving - rest replaces entire turn
    validateNotAlreadyResting, // Can't declare rest twice
  ],
  [COMPLETE_REST_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending,
    validateIsResting, // Must have declared rest first
    validateCompleteRestDiscard, // Validates discard based on hand state
  ],
};
