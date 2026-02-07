/**
 * Banner action validator registry
 * Handles ASSIGN_BANNER_ACTION and USE_BANNER_FEAR_ACTION
 */

import type { Validator } from "../types.js";
import { ASSIGN_BANNER_ACTION, USE_BANNER_FEAR_ACTION } from "@mage-knight/shared";

// Turn validators
import { validateIsPlayersTurn, validateRoundPhase } from "../turnValidators.js";

// Choice validators
import { validateNoChoicePending } from "../choiceValidators.js";

// Banner validators
import {
  validateBannerInHand,
  validateIsBannerArtifact,
  validateHasUnits,
  validateBannerTargetUnit,
  validateBannerFearInCombatBlockPhase,
  validateBannerFearUnit,
  validateBannerFearEnemy,
} from "../bannerValidators.js";

export const bannerRegistry: Record<string, Validator[]> = {
  [ASSIGN_BANNER_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending,
    validateBannerInHand,
    validateIsBannerArtifact,
    validateHasUnits,
    validateBannerTargetUnit,
  ],
  [USE_BANNER_FEAR_ACTION]: [
    validateIsPlayersTurn,
    validateNoChoicePending,
    validateBannerFearInCombatBlockPhase,
    validateBannerFearUnit,
    validateBannerFearEnemy,
  ],
};
