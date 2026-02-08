/**
 * Mana action validator registry
 * Handles USE_MANA_DIE and CONVERT_CRYSTAL standalone actions
 */

import type { Validator } from "../types.js";
import { USE_MANA_DIE_ACTION, CONVERT_CRYSTAL_ACTION } from "@mage-knight/shared";

// Turn validators
import { validateIsPlayersTurn, validateRoundPhase } from "../turnValidators.js";

// Choice validators
import { validateNoChoicePending } from "../choiceValidators.js";

// Mana validators
import {
  validateUseManaDie,
  validateConvertCrystal,
} from "../mana/standaloneManaValidators.js";

export const manaRegistry: Record<string, Validator[]> = {
  [USE_MANA_DIE_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending,
    validateUseManaDie,
  ],
  [CONVERT_CRYSTAL_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending,
    validateConvertCrystal,
  ],
};
