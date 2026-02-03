/**
 * Offer action validator registry
 * Handles BUY_SPELL_ACTION and LEARN_ADVANCED_ACTION_ACTION
 */

import type { Validator } from "../types.js";
import {
  BUY_SPELL_ACTION,
  LEARN_ADVANCED_ACTION_ACTION,
} from "@mage-knight/shared";

// Turn validators
import {
  validateIsPlayersTurn,
  validateRoundPhase,
  validateNotInCombat,
} from "../turnValidators.js";

// Choice validators
import { validateNoChoicePending } from "../choiceValidators.js";

// Round validators
import { validateMustAnnounceEndOfRound } from "../roundValidators.js";

// Offer validators
import {
  validateSpellInOffer,
  validateAtSpellSite,
  validateHasInfluenceForSpell,
  validateNotAlreadyActedForSpell,
  validateAdvancedActionInOffer,
  validateAtAdvancedActionSite,
  validateHasInfluenceForMonasteryAA,
  validateInLevelUpContext,
} from "../offerValidators.js";

export const offerRegistry: Record<string, Validator[]> = {
  [BUY_SPELL_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending,
    validateMustAnnounceEndOfRound,
    validateNotAlreadyActedForSpell,
    validateSpellInOffer,
    validateAtSpellSite,
    validateHasInfluenceForSpell,
  ],
  [LEARN_ADVANCED_ACTION_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending,
    validateMustAnnounceEndOfRound,
    validateAdvancedActionInOffer,
    validateAtAdvancedActionSite,
    validateHasInfluenceForMonasteryAA,
    validateInLevelUpContext,
  ],
};
