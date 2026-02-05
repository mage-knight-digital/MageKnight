/**
 * Banner assignment validators.
 *
 * Validates that banner assignment actions are legal.
 */

import type { Validator } from "./types.js";
import { valid, invalid } from "./types.js";
import {
  BANNER_NOT_IN_HAND,
  BANNER_NOT_A_BANNER,
  BANNER_TARGET_UNIT_NOT_FOUND,
  BANNER_NO_UNITS,
} from "./validationCodes.js";
import { ASSIGN_BANNER_ACTION } from "@mage-knight/shared";
import { getCard } from "../helpers/cardLookup.js";
import { isBannerArtifact } from "../rules/banners.js";

/**
 * Validate that the banner card is in the player's hand.
 */
export const validateBannerInHand: Validator = (state, playerId, action) => {
  if (action.type !== ASSIGN_BANNER_ACTION) return valid();
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return valid(); // Other validators handle this

  if (!player.hand.includes(action.bannerCardId)) {
    return invalid(BANNER_NOT_IN_HAND, "Banner card is not in hand");
  }
  return valid();
};

/**
 * Validate that the card is actually a banner artifact.
 */
export const validateIsBannerArtifact: Validator = (_state, _playerId, action) => {
  if (action.type !== ASSIGN_BANNER_ACTION) return valid();

  const card = getCard(action.bannerCardId);
  if (!card || !isBannerArtifact(card)) {
    return invalid(BANNER_NOT_A_BANNER, "Card is not a banner artifact");
  }
  return valid();
};

/**
 * Validate that the player has at least one unit.
 */
export const validateHasUnits: Validator = (state, playerId, action) => {
  if (action.type !== ASSIGN_BANNER_ACTION) return valid();
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return valid();

  if (player.units.length === 0) {
    return invalid(BANNER_NO_UNITS, "No units to assign banner to");
  }
  return valid();
};

/**
 * Validate that the target unit exists and belongs to the player.
 */
export const validateBannerTargetUnit: Validator = (state, playerId, action) => {
  if (action.type !== ASSIGN_BANNER_ACTION) return valid();
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return valid();

  const unit = player.units.find(
    (u) => u.instanceId === action.targetUnitInstanceId
  );
  if (!unit) {
    return invalid(
      BANNER_TARGET_UNIT_NOT_FOUND,
      "Target unit not found"
    );
  }
  return valid();
};
