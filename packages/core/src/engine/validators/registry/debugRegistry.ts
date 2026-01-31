/**
 * Debug action validator registry
 * Handles DEBUG_ADD_FAME_ACTION and DEBUG_TRIGGER_LEVEL_UP_ACTION
 */

import type { Validator } from "../types.js";
import {
  DEBUG_ADD_FAME_ACTION,
  DEBUG_TRIGGER_LEVEL_UP_ACTION,
} from "@mage-knight/shared";

// Turn validators
import { validateIsPlayersTurn } from "../turnValidators.js";

// Debug validators
import {
  validateDevModeOnly,
  validateHasPendingLevelUps,
} from "../debugValidators.js";

export const debugRegistry: Record<string, Validator[]> = {
  [DEBUG_ADD_FAME_ACTION]: [
    validateDevModeOnly,
    validateIsPlayersTurn,
  ],
  [DEBUG_TRIGGER_LEVEL_UP_ACTION]: [
    validateDevModeOnly,
    validateIsPlayersTurn,
    validateHasPendingLevelUps,
  ],
};
