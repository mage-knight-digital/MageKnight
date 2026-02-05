/**
 * Invocation skill effect handler (Arythea)
 *
 * Once per turn: Discard a card to gain a mana token.
 * - Discard a Wound → gain red or black mana token
 * - Discard a non-Wound → gain white or green mana token
 * - Mana must be used immediately
 *
 * Implementation:
 * - Builds pendingChoice options based on hand contents
 * - Each option is an InvocationResolveEffect encoding the card + mana color
 * - Resolution atomically discards the card and adds the mana token
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { CardEffect } from "../../../types/cards.js";
import type { CardId } from "@mage-knight/shared";
import {
  CARD_WOUND,
  MANA_RED,
  MANA_BLACK,
  MANA_WHITE,
  MANA_GREEN,
} from "@mage-knight/shared";
import { SKILL_ARYTHEA_INVOCATION } from "../../../data/skills/index.js";
import { EFFECT_INVOCATION_RESOLVE } from "../../../types/effectTypes.js";
import { getPlayerIndexByIdOrThrow } from "../../helpers/playerHelpers.js";
import { getCard } from "../../helpers/cardLookup.js";

/**
 * Describes an Invocation option presented to the player.
 */
interface InvocationOption {
  readonly cardId: CardId;
  readonly isWound: boolean;
  readonly manaColor: string;
  readonly description: string;
}

/**
 * Get the display name for a card.
 */
function getCardName(cardId: CardId): string {
  const card = getCard(cardId);
  return card ? card.name : String(cardId);
}

/**
 * Build all valid Invocation options based on the player's hand.
 *
 * Wound cards → red or black mana (2 options per wound)
 * Non-wound cards → white or green mana (2 options per non-wound card)
 */
function buildInvocationOptions(hand: readonly CardId[]): InvocationOption[] {
  const options: InvocationOption[] = [];
  const seenCards = new Set<string>();

  for (const cardId of hand) {
    // Deduplicate: only show one set of options per unique card ID
    // (e.g., if player has 3 wounds, only show wound options once)
    if (seenCards.has(cardId)) continue;
    seenCards.add(cardId);

    const isWound = cardId === CARD_WOUND;
    const cardName = getCardName(cardId);

    if (isWound) {
      // Wound → red or black mana
      options.push({
        cardId,
        isWound: true,
        manaColor: MANA_RED,
        description: `Discard ${cardName} → Red mana`,
      });
      options.push({
        cardId,
        isWound: true,
        manaColor: MANA_BLACK,
        description: `Discard ${cardName} → Black mana`,
      });
    } else {
      // Non-wound → white or green mana
      options.push({
        cardId,
        isWound: false,
        manaColor: MANA_WHITE,
        description: `Discard ${cardName} → White mana`,
      });
      options.push({
        cardId,
        isWound: false,
        manaColor: MANA_GREEN,
        description: `Discard ${cardName} → Green mana`,
      });
    }
  }

  return options;
}

/**
 * Apply the Invocation skill effect.
 *
 * Creates a pending choice with all valid discard + mana gain options.
 * Each option is an InvocationResolveEffect that atomically handles:
 * 1. Removing the card from hand
 * 2. Adding the mana token to pureMana
 */
export function applyInvocationEffect(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  // Build options based on hand contents
  const options = buildInvocationOptions(player.hand);

  if (options.length === 0) {
    // No valid options - shouldn't happen if validators work correctly
    return state;
  }

  // Create pendingChoice with InvocationResolveEffect options
  const choiceOptions: CardEffect[] = options.map((opt) => ({
    type: EFFECT_INVOCATION_RESOLVE as typeof EFFECT_INVOCATION_RESOLVE,
    cardId: opt.cardId,
    isWound: opt.isWound,
    manaColor: opt.manaColor,
    description: opt.description,
  }));

  const updatedPlayer: Player = {
    ...player,
    pendingChoice: {
      cardId: null,
      skillId: SKILL_ARYTHEA_INVOCATION,
      unitInstanceId: null,
      options: choiceOptions,
    },
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return { ...state, players };
}

/**
 * Remove Invocation effect for undo.
 *
 * Clears the pending choice if it's from Invocation.
 */
export function removeInvocationEffect(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  // Clear pending choice if it's from Invocation
  const updatedPlayer: Player = {
    ...player,
    pendingChoice:
      player.pendingChoice?.skillId === SKILL_ARYTHEA_INVOCATION
        ? null
        : player.pendingChoice,
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return { ...state, players };
}

/**
 * Check if Invocation skill can be activated.
 * Used by validActions to determine if the skill should be shown.
 *
 * Requirements:
 * - Player must have at least one card in hand (wound or non-wound)
 */
export function canActivateInvocation(player: Player): boolean {
  return player.hand.length > 0;
}
