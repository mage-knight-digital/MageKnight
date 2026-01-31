/**
 * Round action validator registry
 * Handles ANNOUNCE_END_OF_ROUND_ACTION
 */

import type { Validator } from "../types.js";
import { ANNOUNCE_END_OF_ROUND_ACTION } from "@mage-knight/shared";

// Turn validators
import {
  validateIsPlayersTurn,
  validateRoundPhase,
  validateNotInCombat,
} from "../turnValidators.js";

// Choice validators
import { validateNoChoicePending } from "../choiceValidators.js";

// Round validators
import {
  validateDeckEmpty,
  validateRoundEndNotAnnounced,
} from "../roundValidators.js";

export const roundRegistry: Record<string, Validator[]> = {
  [ANNOUNCE_END_OF_ROUND_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending,
    validateDeckEmpty,
    validateRoundEndNotAnnounced,
  ],
};
