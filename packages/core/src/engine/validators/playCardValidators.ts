/**
 * Validators for PLAY_CARD action
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction, CardId } from "@mage-knight/shared";
import type { ValidationResult } from "./types.js";
import { valid, invalid } from "./types.js";
import { PLAY_CARD_ACTION } from "@mage-knight/shared";
import { getCard } from "../validActions/cards/index.js";
import {
  CARD_NOT_IN_HAND,
  CARD_NOT_FOUND,
  CANNOT_PLAY_WOUND,
  CANNOT_PLAY_HEALING_IN_COMBAT,
  PLAYER_NOT_FOUND,
  INVALID_ACTION_CODE,
  CARD_NOT_PLAYABLE,
  CARD_NOT_PLAYABLE_IN_PHASE,
  CARD_EFFECT_NOT_RESOLVABLE,
  RANGED_ATTACK_ALL_FORTIFIED,
  TIME_BENDING_CHAIN_PREVENTED,
  ALREADY_ACTED,
} from "./validationCodes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";
import type { CardEffectKind } from "../helpers/cardCategoryHelpers.js";
import {
  isHealingOnlyInCombat,
  isTimeBendingChainPrevented,
  isWoundCardId,
  cardConsumesAction,
} from "../rules/cardPlay.js";
import {
  evaluateCardPlayability,
  buildPlayContext,
  buildCombatPlayContext,
} from "../validActions/cards/cardPlayability.js";

function getCardId(action: PlayerAction): CardId | null {
  if (action.type === PLAY_CARD_ACTION && "cardId" in action) {
    return action.cardId;
  }
  return null;
}

// Card must be in player's hand
export function validateCardInHand(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  const cardId = getCardId(action);
  if (!cardId) {
    return invalid(INVALID_ACTION_CODE, "Invalid play card action");
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

// Card must exist in definitions
export function validateCardExists(
  _state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  const cardId = getCardId(action);
  if (!cardId) {
    return invalid(INVALID_ACTION_CODE, "Invalid play card action");
  }

  // Check if card exists in any card registry (basic, advanced, spell)
  const card = getCard(cardId);
  if (!card) {
    return invalid(CARD_NOT_FOUND, "Card definition not found");
  }

  return valid();
}

// Cannot play wound cards normally (they clog your hand)
export function validateNotWound(
  _state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  const cardId = getCardId(action);
  if (!cardId) {
    return invalid(INVALID_ACTION_CODE, "Invalid play card action");
  }

  // Check if card exists first using the universal getter
  const card = getCard(cardId);
  if (!card) {
    // Card not found - let validateCardExists handle this
    return valid();
  }

  if (isWoundCardId(cardId, card)) {
    return invalid(
      CANNOT_PLAY_WOUND,
      "Wound cards cannot be played for their effect"
    );
  }

  return valid();
}

// Healing-only cards cannot be played during combat (rulebook restriction).
export function validateNoHealingCardInCombat(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PLAY_CARD_ACTION) {
    return valid();
  }

  if (!state.combat) {
    return valid();
  }

  if (!("cardId" in action)) {
    return invalid(INVALID_ACTION_CODE, "Invalid play card action");
  }

  const card = getCard(action.cardId);
  if (!card) {
    return valid();
  }

  const effectKind: CardEffectKind = action.powered ? "powered" : "basic";
  if (isHealingOnlyInCombat(card, effectKind)) {
    return invalid(
      CANNOT_PLAY_HEALING_IN_COMBAT,
      "Healing cards cannot be played during combat"
    );
  }

  return valid();
}

// Validate that the card's effect is playable in the current context (combat phase or normal turn)
export function validateCardPlayableInContext(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PLAY_CARD_ACTION) {
    return valid();
  }

  const card = getCard(action.cardId);
  if (!card) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  const effectKind: CardEffectKind = action.powered ? "powered" : "basic";

  // Use the unified playability evaluation
  const ctx = state.combat
    ? buildCombatPlayContext(state, player, state.combat)
    : buildPlayContext(state, player);
  const result = evaluateCardPlayability(state, player, card, action.cardId, ctx);
  const effectResult = effectKind === "basic" ? result.basic : result.powered;

  if (!effectResult.costPayable) {
    return invalid(
      CARD_EFFECT_NOT_RESOLVABLE,
      "Card requires discarding another card, but no eligible card is available"
    );
  }

  if (effectResult.excludedByRanged) {
    return invalid(
      RANGED_ATTACK_ALL_FORTIFIED,
      "Ranged attacks cannot target fortified enemies"
    );
  }

  if (!effectResult.allowed) {
    if (state.combat) {
      // Check if it's a phase restriction issue vs general phase issue
      if (card.combatPhaseRestriction && !card.combatPhaseRestriction.includes(state.combat.phase)) {
        return invalid(
          CARD_NOT_PLAYABLE_IN_PHASE,
          `Card can only be played at the start of combat`
        );
      }
      return invalid(
        CARD_NOT_PLAYABLE_IN_PHASE,
        `Card cannot be played in ${state.combat.phase} phase`
      );
    }
    return invalid(
      CARD_NOT_PLAYABLE,
      "Card cannot be played outside combat"
    );
  }

  if (!effectResult.resolvable) {
    return invalid(
      CARD_EFFECT_NOT_RESOLVABLE,
      "Card effect cannot be resolved right now"
    );
  }

  return valid();
}

// Cannot play Space Bending powered during a Time Bent turn (chain prevention)
export function validateTimeBendingChain(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PLAY_CARD_ACTION) {
    return valid();
  }

  if (!("cardId" in action) || !("powered" in action)) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return valid();
  }

  if (isTimeBendingChainPrevented(action.cardId, action.powered ?? false, player.isTimeBentTurn)) {
    return invalid(
      TIME_BENDING_CHAIN_PREVENTED,
      "Cannot play Space Bending powered during a Time Bent turn"
    );
  }

  return valid();
}

// Cards with CATEGORY_ACTION cannot be played when the player has already taken an action
export function validateActionCardNotAlreadyActed(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PLAY_CARD_ACTION) {
    return valid();
  }

  const card = getCard(action.cardId);
  if (!card) {
    return valid();
  }

  if (!cardConsumesAction(card)) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (player.hasTakenActionThisTurn) {
    return invalid(
      ALREADY_ACTED,
      "This card can only be played as your action, and you have already taken an action this turn"
    );
  }

  return valid();
}
