/**
 * Movement validators routing - MOVE_ACTION, EXPLORE_ACTION
 */

import type { ValidatorRegistry } from "./types.js";
import { MOVE_ACTION, EXPLORE_ACTION } from "@mage-knight/shared";

import {
  validateIsPlayersTurn,
  validateRoundPhase,
  validateNotInCombat,
  validateHasNotActed,
} from "../turnValidators.js";

import {
  validatePlayerOnMap,
  validateTargetAdjacent,
  validateTargetHexExists,
  validateTerrainPassable,
  validateEnoughMovePoints,
  validateNotBlockedByRampaging,
  validateCityEntryAllowed,
} from "../movementValidators.js";

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

import {
  validateNoChoicePending,
} from "../choiceValidators.js";

import {
  validateNoPendingLevelUpRewards,
} from "../levelUpValidators.js";

import {
  validateMustAnnounceEndOfRound,
} from "../roundValidators.js";

import {
  validateNotRestingForMovement,
} from "../restValidators.js";

export const movementValidatorRegistry: ValidatorRegistry = {
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
