/**
 * REST action validators
 *
 * REST allows a player to discard cards from their hand to cycle their deck.
 * Two types:
 * - Standard Rest: Discard exactly one non-wound card (plus any wounds)
 * - Slow Recovery: When hand is ALL wounds, discard exactly one wound
 *
 * All discarded cards go to the discard pile (wounds are NOT healed).
 *
 * NEW: Two-phase resting (per FAQ p.30):
 * 1. DECLARE_REST - enters resting state, blocks movement/combat/interaction
 * 2. COMPLETE_REST - completes rest with card discards
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { ValidationResult } from "./types.js";
import { valid, invalid } from "./types.js";
import {
  REST_ACTION,
  REST_TYPE_STANDARD,
  REST_TYPE_SLOW_RECOVERY,
  DECLARE_REST_ACTION,
  COMPLETE_REST_ACTION,
} from "@mage-knight/shared";
import { getBasicActionCard } from "../../data/basicActions/index.js";
import { DEED_CARD_TYPE_WOUND } from "../../types/cards.js";
import type { BasicActionCardId } from "@mage-knight/shared";
import {
  REST_NO_DISCARD,
  CARD_NOT_IN_HAND,
  PLAYER_NOT_FOUND,
  STANDARD_REST_ONE_NON_WOUND,
  SLOW_RECOVERY_INVALID,
  SLOW_RECOVERY_ONE_WOUND,
  SLOW_RECOVERY_MUST_BE_WOUND,
  CANNOT_MOVE_WHILE_RESTING,
  CANNOT_FIGHT_WHILE_RESTING,
  CANNOT_INTERACT_WHILE_RESTING,
  CANNOT_ENTER_SITE_WHILE_RESTING,
  MUST_COMPLETE_REST,
  ALREADY_RESTING,
  NOT_RESTING,
  SLOW_RECOVERY_NO_DISCARD_ALLOWED,
  CANNOT_REST_AFTER_MOVING,
} from "./validationCodes.js";

/**
 * Helper to check if a card is a wound
 */
function isWoundCard(cardId: string): boolean {
  try {
    const card = getBasicActionCard(cardId as BasicActionCardId);
    return card.cardType === DEED_CARD_TYPE_WOUND;
  } catch {
    // If card not found in basic actions, assume it's not a wound
    return false;
  }
}

/**
 * Must discard at least one card to rest
 */
export function validateRestHasDiscard(
  _state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== REST_ACTION) return valid();

  if (!action.discardCardIds || action.discardCardIds.length === 0) {
    return invalid(REST_NO_DISCARD, "Must discard at least one card to rest");
  }

  return valid();
}

/**
 * All discarded cards must be in hand
 */
export function validateRestCardsInHand(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== REST_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  for (const cardId of action.discardCardIds) {
    if (!player.hand.includes(cardId)) {
      return invalid(CARD_NOT_IN_HAND, `Card ${cardId} is not in your hand`);
    }
  }

  return valid();
}

/**
 * Validate Standard Rest: exactly one non-wound, any number of wounds
 */
export function validateStandardRest(
  _state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== REST_ACTION) return valid();
  if (action.restType !== REST_TYPE_STANDARD) return valid();

  let nonWoundCount = 0;

  for (const cardId of action.discardCardIds) {
    if (!isWoundCard(cardId)) {
      nonWoundCount++;
    }
  }

  if (nonWoundCount !== 1) {
    return invalid(
      STANDARD_REST_ONE_NON_WOUND,
      "Standard Rest requires exactly one non-wound card (plus any number of wounds)"
    );
  }

  return valid();
}

/**
 * Validate Slow Recovery: exactly one wound, no non-wounds, hand must be all wounds
 */
export function validateSlowRecovery(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== REST_ACTION) return valid();
  if (action.restType !== REST_TYPE_SLOW_RECOVERY) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  // Hand must contain ONLY wounds
  const hasNonWoundInHand = player.hand.some((cardId) => !isWoundCard(cardId));

  if (hasNonWoundInHand) {
    return invalid(
      SLOW_RECOVERY_INVALID,
      "Slow Recovery is only allowed when your hand contains only wound cards"
    );
  }

  // Must discard exactly one wound
  if (action.discardCardIds.length !== 1) {
    return invalid(
      SLOW_RECOVERY_ONE_WOUND,
      "Slow Recovery requires discarding exactly one wound card"
    );
  }

  const discardedCard = action.discardCardIds[0];
  if (!discardedCard || !isWoundCard(discardedCard)) {
    return invalid(
      SLOW_RECOVERY_MUST_BE_WOUND,
      "Slow Recovery must discard a wound card"
    );
  }

  return valid();
}

// ============================================================================
// TWO-PHASE REST VALIDATORS (NEW STATE-BASED RESTING)
// ============================================================================

/**
 * Validate that player is not already resting (for DECLARE_REST)
 */
export function validateNotAlreadyResting(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== DECLARE_REST_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  if (player.isResting) {
    return invalid(ALREADY_RESTING, "You are already resting");
  }

  return valid();
}

/**
 * Validate that player has not moved this turn (for DECLARE_REST)
 * Per FAQ: Rest means "no Movement Phase" - you can't move first then rest.
 * Rest replaces your entire turn, not just the action phase.
 */
export function validateNotMovedForRest(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== DECLARE_REST_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  if (player.hasMovedThisTurn) {
    return invalid(
      CANNOT_REST_AFTER_MOVING,
      "Cannot rest after moving - rest replaces your entire turn"
    );
  }

  return valid();
}

/**
 * Validate that player is resting (for COMPLETE_REST)
 */
export function validateIsResting(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== COMPLETE_REST_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  if (!player.isResting) {
    return invalid(NOT_RESTING, "You must declare rest first before completing it");
  }

  return valid();
}

/**
 * Validate complete rest has valid discards.
 * Rest type is determined automatically:
 * - If hand has non-wounds: Standard Rest (1 non-wound + any wounds)
 * - If hand has only wounds: Slow Recovery (1 wound)
 * - If hand is empty (all wounds healed): Slow Recovery with no discard is valid
 */
export function validateCompleteRestDiscard(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== COMPLETE_REST_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  // Check if all cards in discard selection are in hand
  for (const cardId of action.discardCardIds) {
    if (!player.hand.includes(cardId)) {
      return invalid(CARD_NOT_IN_HAND, `Card ${cardId} is not in your hand`);
    }
  }

  // Determine rest type based on current hand state
  const hasNonWoundInHand = player.hand.some((cardId) => !isWoundCard(cardId));

  if (hasNonWoundInHand) {
    // Standard Rest: must discard exactly 1 non-wound + any wounds
    let nonWoundCount = 0;
    for (const cardId of action.discardCardIds) {
      if (!isWoundCard(cardId)) {
        nonWoundCount++;
      }
    }

    if (nonWoundCount !== 1) {
      return invalid(
        STANDARD_REST_ONE_NON_WOUND,
        "Standard Rest requires discarding exactly one non-wound card (plus any number of wounds)"
      );
    }
  } else {
    // Hand has only wounds (or is empty)
    if (player.hand.length === 0) {
      // Special case (FAQ Q2 A2): All wounds were healed during rest
      // Slow Recovery with no discard is valid
      if (action.discardCardIds.length !== 0) {
        return invalid(
          SLOW_RECOVERY_NO_DISCARD_ALLOWED,
          "Your hand is empty - no discard needed for Slow Recovery"
        );
      }
    } else {
      // Hand has only wounds - Slow Recovery
      if (action.discardCardIds.length !== 1) {
        return invalid(
          SLOW_RECOVERY_ONE_WOUND,
          "Slow Recovery requires discarding exactly one wound card"
        );
      }

      const discardedCard = action.discardCardIds[0];
      if (!discardedCard || !isWoundCard(discardedCard)) {
        return invalid(
          SLOW_RECOVERY_MUST_BE_WOUND,
          "Slow Recovery must discard a wound card"
        );
      }
    }
  }

  return valid();
}

/**
 * Validate that player cannot move while resting
 * Per FAQ S3: "Resting doesn't prevent you from playing cards: it merely prevents
 * you from Moving, Fighting, Interacting, or doing anything 'as your Action'."
 */
export function validateNotRestingForMovement(
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  if (player.isResting) {
    return invalid(CANNOT_MOVE_WHILE_RESTING, "Cannot move while resting");
  }

  return valid();
}

/**
 * Validate that player cannot initiate combat while resting
 */
export function validateNotRestingForCombat(
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  if (player.isResting) {
    return invalid(CANNOT_FIGHT_WHILE_RESTING, "Cannot fight while resting");
  }

  return valid();
}

/**
 * Validate that player cannot interact with sites while resting
 * Per FAQ S5: Monastery healing is blocked during rest
 */
export function validateNotRestingForInteraction(
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  if (player.isResting) {
    return invalid(CANNOT_INTERACT_WHILE_RESTING, "Cannot interact with sites while resting");
  }

  return valid();
}

/**
 * Validate that player cannot enter adventure sites while resting
 */
export function validateNotRestingForEnterSite(
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  if (player.isResting) {
    return invalid(CANNOT_ENTER_SITE_WHILE_RESTING, "Cannot enter sites while resting");
  }

  return valid();
}

/**
 * Validate that player must complete rest before ending turn
 */
export function validateRestCompleted(
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  if (player.isResting) {
    return invalid(MUST_COMPLETE_REST, "You must complete your rest before ending your turn");
  }

  return valid();
}
