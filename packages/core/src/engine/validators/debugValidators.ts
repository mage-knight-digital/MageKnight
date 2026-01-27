/**
 * Debug Validators
 *
 * Validators for debug actions that should only be allowed in development mode.
 */

import type { Validator } from "./types.js";
import { valid, invalid } from "./types.js";
import { DEV_MODE_REQUIRED, NO_PENDING_LEVEL_UPS } from "./validationCodes.js";
import type { GameState } from "../../state/GameState.js";

// Type declaration for Node.js-like process global
declare const process: { env?: { NODE_ENV?: string } } | undefined;

/**
 * Check if the environment is production.
 * This check is safe for environments where process may not be defined.
 */
function isProductionEnvironment(): boolean {
  // Check process.env.NODE_ENV if available (Node.js environments)
  try {
    if (typeof process !== "undefined" && process?.env?.NODE_ENV === "production") {
      return true;
    }
  } catch {
    // process not available (e.g., browser without polyfill)
  }
  // In browser environments without process, assume not production
  // (production builds would typically bundle with NODE_ENV set)
  return false;
}

/**
 * Check if we're in development mode.
 * Debug actions are rejected in production builds.
 */
export const validateDevModeOnly: Validator = (_state, _playerId, _action) => {
  if (isProductionEnvironment()) {
    return invalid(DEV_MODE_REQUIRED, "Debug actions are not allowed in production");
  }
  return valid();
};

/**
 * Validate that the player has pending level ups to process.
 * Used by DEBUG_TRIGGER_LEVEL_UP to ensure there's something to process.
 */
export const validateHasPendingLevelUps: Validator = (
  state: GameState,
  playerId: string,
  _action
) => {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return valid(); // Let turn validators handle this
  }

  if (player.pendingLevelUps.length === 0) {
    return invalid(NO_PENDING_LEVEL_UPS, "No pending level ups to process");
  }

  return valid();
};
