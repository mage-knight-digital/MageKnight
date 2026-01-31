/**
 * Interaction action validator registry
 * Handles INTERACT_ACTION and ENTER_SITE_ACTION
 */

import type { Validator } from "../types.js";
import { INTERACT_ACTION, ENTER_SITE_ACTION } from "@mage-knight/shared";

// Turn validators
import {
  validateIsPlayersTurn,
  validateRoundPhase,
  validateNotInCombat,
  validateHasNotActed,
} from "../turnValidators.js";

// Choice validators
import { validateNoChoicePending } from "../choiceValidators.js";

// Round validators
import { validateMustAnnounceEndOfRound } from "../roundValidators.js";

// Rest validators
import {
  validateNotRestingForInteraction,
  validateNotRestingForEnterSite,
} from "../restValidators.js";

// Level up validators
import { validateNoPendingLevelUpRewards } from "../levelUpValidators.js";

// Interact validators
import {
  validateAtInhabitedSite,
  validateSiteAccessible,
  validateHealingPurchase,
} from "../interactValidators.js";

// Site validators
import {
  validateAtAdventureSite,
  validateSiteNotConquered,
  validateSiteHasEnemiesOrDraws,
} from "../siteValidators.js";

export const interactionRegistry: Record<string, Validator[]> = {
  [INTERACT_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending,
    validateNoPendingLevelUpRewards, // Must select level up rewards first
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    validateNotRestingForInteraction, // Cannot interact with sites while resting (FAQ S5)
    validateHasNotActed,
    validateAtInhabitedSite,
    validateSiteAccessible,
    validateHealingPurchase,
  ],
  [ENTER_SITE_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending,
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    validateNotRestingForEnterSite, // Cannot enter sites while resting
    validateHasNotActed, // Must not have taken action this turn
    validateAtAdventureSite,
    validateSiteNotConquered,
    validateSiteHasEnemiesOrDraws,
  ],
};
