/**
 * Validators for PLAY_CARD_SIDEWAYS action
 *
 * Any non-Wound card can be played sideways, with available gains based on context:
 * - Outside combat: Move 1 or Influence 1
 * - Combat Block phase: Block 1
 * - Combat Attack phase: Attack 1
 * This applies to Basic Actions, Advanced Actions, Spells, Artifacts, etc.
 */

// RULES: Sideways restrictions (partial)
// =================================================
// Per rulebook L652: "Cards cannot be played sideways to contribute to Ranged or Siege Attacks."
// Per rulebook L694: Sideways Block is always physical, never elemental.
// Per rulebook L779: Sideways Attack is always physical Attack 1.
// Per rulebook L1020 (PvP): Adding sideways to an attack makes the whole attack count as physical.
//
// Implemented here:
// - Phase restrictions: no sideways in Ranged/Siege; Block-only in Block phase; Attack-only in Attack phase.
//
// TODO:
// - Implement attack "contamination" where adding sideways makes combined attacks physical.
// =================================================

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction, CardId } from "@mage-knight/shared";
import type { ValidationResult } from "./types.js";
import { valid, invalid } from "./types.js";
import { PLAY_CARD_SIDEWAYS_ACTION } from "@mage-knight/shared";
import { isRuleActive } from "../modifiers/index.js";
import { RULE_WOUNDS_PLAYABLE_SIDEWAYS } from "../../types/modifierConstants.js";
import {
  CARD_NOT_IN_HAND,
  CANNOT_PLAY_WOUND,
  PLAYER_NOT_FOUND,
  INVALID_ACTION_CODE,
  SIDEWAYS_CHOICE_REQUIRED,
} from "./validationCodes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";
import {
  getAllowedSidewaysChoices,
  getSidewaysContext,
  canPlaySideways,
} from "../rules/sideways.js";
import { isWoundCardId } from "../rules/cardPlay.js";

function getCardIdForSideways(action: PlayerAction): CardId | null {
  if (action.type === PLAY_CARD_SIDEWAYS_ACTION && "cardId" in action) {
    return action.cardId;
  }
  return null;
}

// Card must be in player's hand
export function validateSidewaysCardInHand(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  const cardId = getCardIdForSideways(action);
  if (!cardId) {
    return invalid(INVALID_ACTION_CODE, "Invalid sideways play action");
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.hand.includes(cardId)) {
    return invalid(CARD_NOT_IN_HAND, "Card is not in your hand");
  }

  return valid();
}

// Cannot play wound cards sideways
// Any non-Wound card can be played sideways - this includes Basic Actions,
// Advanced Actions, Spells, Artifacts, etc. When new card types are added,
// they will automatically be valid for sideways play (unless they are wounds).
export function validateSidewaysNotWound(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  const cardId = getCardIdForSideways(action);
  if (!cardId) {
    return invalid(INVALID_ACTION_CODE, "Invalid sideways play action");
  }

  if (isWoundCardId(cardId, null)) {
    if (isRuleActive(state, playerId, RULE_WOUNDS_PLAYABLE_SIDEWAYS)) {
      return valid();
    }
    return invalid(
      CANNOT_PLAY_WOUND,
      "Wound cards cannot be played sideways"
    );
  }

  // All other cards (Basic Actions, Advanced Actions, Spells, Artifacts, etc.)
  // are valid for sideways play
  return valid();
}

// Must specify what to gain from sideways play
export function validateSidewaysChoice(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PLAY_CARD_SIDEWAYS_ACTION) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!canPlaySideways(state, player.isResting, player.hasRestedThisTurn, player.hand)) {
    if (player.isResting) {
      return invalid(
        SIDEWAYS_CHOICE_REQUIRED,
        "Cannot play cards sideways while resting"
      );
    }

    return invalid(
      SIDEWAYS_CHOICE_REQUIRED,
      "Sideways play is not allowed in this phase"
    );
  }

  const allowedChoices = getAllowedSidewaysChoices(
    getSidewaysContext(state, player.hasRestedThisTurn, player.hand)
  );
  if (allowedChoices.length === 0) {
    return invalid(
      SIDEWAYS_CHOICE_REQUIRED,
      "Sideways play is not allowed in this phase"
    );
  }

  if (!("as" in action) || !action.as) {
    return invalid(
      SIDEWAYS_CHOICE_REQUIRED,
      "Must specify Move, Influence, Attack, or Block for sideways play"
    );
  }

  if (!allowedChoices.includes(action.as)) {
    return invalid(SIDEWAYS_CHOICE_REQUIRED, "Invalid sideways choice");
  }

  return valid();
}
