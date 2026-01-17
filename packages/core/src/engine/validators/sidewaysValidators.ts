/**
 * Validators for PLAY_CARD_SIDEWAYS action
 *
 * Any non-Wound card can be played sideways to gain Move 1, Influence 1, Attack 1, or Block 1.
 * This applies to Basic Actions, Advanced Actions, Spells, Artifacts, etc.
 */

// TODO: RULES - Phase restrictions for sideways play
// =================================================
// Per rulebook L652: "Cards cannot be played sideways to contribute to Ranged or Siege Attacks."
// Per rulebook L694: Sideways Block is always physical, never elemental.
// Per rulebook L779: Sideways Attack is always physical Attack 1.
// Per rulebook L1020 (PvP): Adding sideways to an attack makes the whole attack count as physical.
//
// These restrictions require combat phase tracking, which isn't implemented yet.
// When combat is added:
// 1. Block sideways Attack during Ranged/Siege phase
// 2. Track sideways attacks as explicitly physical for resistance calculations
// 3. Implement attack "contamination" where sideways makes elemental attacks also physical
// =================================================

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction, CardId, BasicActionCardId } from "@mage-knight/shared";
import type { ValidationResult } from "./types.js";
import { valid, invalid } from "./types.js";
import {
  PLAY_CARD_SIDEWAYS_ACTION,
  PLAY_SIDEWAYS_AS_MOVE,
  PLAY_SIDEWAYS_AS_INFLUENCE,
  PLAY_SIDEWAYS_AS_ATTACK,
  PLAY_SIDEWAYS_AS_BLOCK,
  CARD_WOUND,
} from "@mage-knight/shared";
import { BASIC_ACTION_CARDS, getBasicActionCard } from "../../data/basicActions/index.js";
import { DEED_CARD_TYPE_WOUND } from "../../types/cards.js";
import {
  CARD_NOT_IN_HAND,
  CANNOT_PLAY_WOUND,
  PLAYER_NOT_FOUND,
  INVALID_ACTION_CODE,
  SIDEWAYS_CHOICE_REQUIRED,
} from "./validationCodes.js";

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

  const player = state.players.find((p) => p.id === playerId);
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
  _state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  const cardId = getCardIdForSideways(action);
  if (!cardId) {
    return invalid(INVALID_ACTION_CODE, "Invalid sideways play action");
  }

  // Check against the wound card ID directly
  if (cardId === CARD_WOUND) {
    return invalid(
      CANNOT_PLAY_WOUND,
      "Wound cards cannot be played sideways"
    );
  }

  // For cards in the basic action registry, also check by card type
  // This handles cases where wound cards might have different IDs
  if (cardId in BASIC_ACTION_CARDS) {
    const card = getBasicActionCard(cardId as BasicActionCardId);
    if (card.cardType === DEED_CARD_TYPE_WOUND) {
      return invalid(
        CANNOT_PLAY_WOUND,
        "Wound cards cannot be played sideways"
      );
    }
  }

  // All other cards (Basic Actions, Advanced Actions, Spells, Artifacts, etc.)
  // are valid for sideways play
  return valid();
}

// Must specify what to gain from sideways play
export function validateSidewaysChoice(
  _state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PLAY_CARD_SIDEWAYS_ACTION) {
    return valid();
  }

  if (!("as" in action) || !action.as) {
    return invalid(
      SIDEWAYS_CHOICE_REQUIRED,
      "Must specify Move, Influence, Attack, or Block for sideways play"
    );
  }

  const validChoices = [
    PLAY_SIDEWAYS_AS_MOVE,
    PLAY_SIDEWAYS_AS_INFLUENCE,
    PLAY_SIDEWAYS_AS_ATTACK,
    PLAY_SIDEWAYS_AS_BLOCK,
  ];

  if (!validChoices.includes(action.as)) {
    return invalid(SIDEWAYS_CHOICE_REQUIRED, "Invalid sideways choice");
  }

  return valid();
}
