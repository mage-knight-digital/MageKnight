/**
 * Movement action validator registry
 * Handles MOVE_ACTION and EXPLORE_ACTION
 */

import type { Validator } from "../types.js";
import { MOVE_ACTION, EXPLORE_ACTION } from "@mage-knight/shared";

// Turn validators
import {
  validateIsPlayersTurn,
  validateRoundPhase,
  validateNotInCombat,
  validateHasNotActed,
} from "../turnValidators.js";

// Movement validators
import {
  validatePlayerOnMap,
  validateTargetAdjacent,
  validateTargetHexExists,
  validateTerrainPassable,
  validateEnoughMovePoints,
  validateNotBlockedByRampaging,
  validateCityEntryAllowed,
} from "../movementValidators.js";

// Explore validators
import {
  validatePlayerOnMapForExplore,
  validateOnEdgeHex,
  validateExploreDirection,
  validateWedgeDirection,
  validateSlotNotFilled,
  validateExploreMoveCost,
  validateTilesAvailable,
  validateCoreNotOnCoastline,
} from "../exploreValidators.js";

// Choice validators
import { validateNoChoicePending } from "../choiceValidators.js";

// Round validators
import { validateMustAnnounceEndOfRound } from "../roundValidators.js";

// Rest validators
import { validateNotRestingForMovement } from "../restValidators.js";

// Level up validators
import { validateNoPendingLevelUpRewards } from "../levelUpValidators.js";

export const movementRegistry: Record<string, Validator[]> = {
  [MOVE_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending, // Must resolve pending choice first
    validateNoPendingLevelUpRewards, // Must select level up rewards first
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    validateNotRestingForMovement, // Cannot move while resting (FAQ S3)
    validateHasNotActed, // Must move BEFORE taking action
    validatePlayerOnMap,
    validateTargetAdjacent,
    validateTargetHexExists,
    validateTerrainPassable,
    validateNotBlockedByRampaging, // Can't enter hex with rampaging enemies
    validateCityEntryAllowed, // Scenario rules for city entry
    validateEnoughMovePoints,
  ],
  [EXPLORE_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending, // Must resolve pending choice first
    validateNoPendingLevelUpRewards, // Must select level up rewards first
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    validateNotRestingForMovement, // Cannot explore while resting (movement action)
    validateHasNotActed,
    validatePlayerOnMapForExplore,
    validateOnEdgeHex,
    validateExploreMoveCost, // Check cost before direction (direction check uses getValidExploreOptions which needs these)
    validateTilesAvailable,
    validateExploreDirection, // Uses getValidExploreOptions which checks all tiles and adjacency
    validateWedgeDirection, // Wedge maps only allow NE/E directions
    validateCoreNotOnCoastline, // Wedge maps: core tiles cannot be on coastline
    validateSlotNotFilled, // Now handled by validateExploreDirection
  ],
};
