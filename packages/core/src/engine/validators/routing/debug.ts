/**
 * Debug validators routing - DEBUG_ADD_FAME, DEBUG_TRIGGER_LEVEL_UP
 */

import type { ValidatorRegistry } from "./types.js";
import {
  DEBUG_ADD_FAME_ACTION,
  DEBUG_TRIGGER_LEVEL_UP_ACTION,
} from "@mage-knight/shared";

import {
  validateIsPlayersTurn,
} from "../turnValidators.js";

import {
  validateDevModeOnly,
  validateHasPendingLevelUps,
} from "../debugValidators.js";

export const debugValidatorRegistry: ValidatorRegistry = {
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
