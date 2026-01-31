/**
 * Hostile action validator registry
 * Handles BURN_MONASTERY_ACTION and PLUNDER_VILLAGE_ACTION
 */

import type { Validator } from "../types.js";
import {
  BURN_MONASTERY_ACTION,
  PLUNDER_VILLAGE_ACTION,
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

// Round validators
import { validateMustAnnounceEndOfRound } from "../roundValidators.js";

// Burn monastery validators
import {
  validateAtMonastery,
  validateMonasteryNotBurned,
  validateNoCombatThisTurnForBurn,
} from "../burnMonasteryValidators.js";

// Plunder village validators
import {
  validateAtVillage,
  validateNotAlreadyPlundered,
  validateBeforeTurnForPlunder,
} from "../plunderVillageValidators.js";

export const hostileRegistry: Record<string, Validator[]> = {
  [BURN_MONASTERY_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending,
    validateMustAnnounceEndOfRound,
    validateHasNotActed, // Can only burn if haven't taken action
    validateNoCombatThisTurnForBurn, // Can only have one combat per turn
    validateAtMonastery,
    validateMonasteryNotBurned,
  ],
  [PLUNDER_VILLAGE_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending,
    validateMustAnnounceEndOfRound,
    validateBeforeTurnForPlunder, // Must plunder before taking any action or moving
    validateAtVillage,
    validateNotAlreadyPlundered,
  ],
};
