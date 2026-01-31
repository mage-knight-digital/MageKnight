/**
 * Level up action validator registry
 * Handles CHOOSE_LEVEL_UP_REWARDS_ACTION
 */

import type { Validator } from "../types.js";
import { CHOOSE_LEVEL_UP_REWARDS_ACTION } from "@mage-knight/shared";

// Turn validators
import { validateIsPlayersTurn } from "../turnValidators.js";

// Level up reward validators
import {
  validateHasPendingLevelUpRewards,
  validateLevelInPendingRewards,
  validateSkillAvailable,
  validateSkillNotAlreadyOwned,
  validateAAInLevelUpOffer,
} from "../levelUpValidators.js";

export const levelUpRegistry: Record<string, Validator[]> = {
  [CHOOSE_LEVEL_UP_REWARDS_ACTION]: [
    validateIsPlayersTurn,
    validateHasPendingLevelUpRewards,
    validateLevelInPendingRewards,
    validateSkillAvailable,
    validateSkillNotAlreadyOwned,
    validateAAInLevelUpOffer,
  ],
};
