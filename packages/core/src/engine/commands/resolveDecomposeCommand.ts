/**
 * Resolve Decompose Command
 *
 * Handles player resolution of a pending decompose (Decompose advanced action).
 * When the player selects an action card to throw away:
 * - Card is permanently removed from the game (added to removedCards)
 * - Basic mode: gain 2 crystals matching the card's color
 * - Powered mode: gain 1 crystal of each basic color NOT matching the card's color
 *
 * Flow:
 * 1. Card played creates pendingDecompose via EFFECT_DECOMPOSE
 * 2. Player sends RESOLVE_DECOMPOSE action with selected cardId
 * 3. Card is removed from hand → added to removedCards (permanent)
 * 4. Crystals are granted based on mode and card color
 *
 * This command is reversible since it's part of normal card play flow.
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { GameEvent, CardId, BasicManaColor } from "@mage-knight/shared";
import { CARD_DESTROYED, MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE } from "@mage-knight/shared";
import type { Player, PendingDecompose, Crystals } from "../../types/player.js";
import { RESOLVE_DECOMPOSE_COMMAND } from "./commandTypes.js";
import { getCardsEligibleForDecompose } from "../effects/decomposeEffects.js";
import { getActionCardColor } from "../helpers/cardColor.js";

export { RESOLVE_DECOMPOSE_COMMAND };

export interface ResolveDecomposeCommandParams {
  readonly playerId: string;
  /** Card ID of the action card to throw away */
  readonly cardId: CardId;
}

export function createResolveDecomposeCommand(
  params: ResolveDecomposeCommandParams
): Command {
  // Store previous state for undo
  let previousPendingDecompose: PendingDecompose | null = null;
  let previousHand: readonly CardId[] = [];
  let previousRemovedCards: readonly CardId[] = [];
  let previousCrystals: Crystals | null = null;

  return {
    type: RESOLVE_DECOMPOSE_COMMAND,
    playerId: params.playerId,
    isReversible: true, // Part of normal card play flow

    execute(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error("Player not found");
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error("Player not found at index");
      }

      if (!player.pendingDecompose) {
        throw new Error("No pending decompose to resolve");
      }

      const pending = player.pendingDecompose;

      // Store for undo
      previousPendingDecompose = pending;
      previousHand = player.hand;
      previousRemovedCards = player.removedCards;
      previousCrystals = player.crystals;

      const events: GameEvent[] = [];

      // Validate card is eligible
      const eligibleCards = getCardsEligibleForDecompose(player.hand, pending.sourceCardId);
      if (!eligibleCards.includes(params.cardId)) {
        throw new Error(
          `Card ${params.cardId} is not eligible for Decompose (must be an action card in hand, not the Decompose card itself)`
        );
      }

      // Remove card from hand
      const updatedHand = [...player.hand];
      const cardIndex = updatedHand.indexOf(params.cardId);
      if (cardIndex === -1) {
        throw new Error(`Card ${params.cardId} not found in hand`);
      }
      updatedHand.splice(cardIndex, 1);

      // Add to removedCards (permanent removal - throw away)
      const updatedRemovedCards = [...player.removedCards, params.cardId];

      // Emit card destroyed event (permanent removal)
      events.push({
        type: CARD_DESTROYED,
        playerId: params.playerId,
        cardId: params.cardId,
      });

      // Get the action card color
      const cardColor = getActionCardColor(params.cardId);
      if (!cardColor) {
        // Should not happen since we filter for action cards in eligibility check
        throw new Error(`Card ${params.cardId} has no color (not an action card)`);
      }

      // Convert card color to mana color
      const manaColor = cardColorToManaColor(cardColor);

      // Grant crystals based on mode
      let updatedCrystals: Crystals;
      if (pending.mode === "basic") {
        // Basic: gain 2 crystals of matching color
        updatedCrystals = addCrystals(player.crystals, manaColor, 2);
      } else {
        // Powered: gain 1 crystal of each basic color NOT matching
        const nonMatchingColors = ALL_BASIC_COLORS.filter((c) => c !== manaColor);
        updatedCrystals = player.crystals;
        for (const color of nonMatchingColors) {
          updatedCrystals = addCrystals(updatedCrystals, color, 1);
        }
      }

      // Clear pending state
      const updatedPlayer: Player = {
        ...player,
        hand: updatedHand,
        removedCards: updatedRemovedCards,
        crystals: updatedCrystals,
        pendingDecompose: null,
      };

      const newState: GameState = {
        ...state,
        players: state.players.map((p, i) =>
          i === playerIndex ? updatedPlayer : p
        ),
      };

      return {
        state: newState,
        events,
      };
    },

    undo(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error("Player not found");
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error("Player not found at index");
      }

      // Restore previous state
      const restoredPlayer: Player = {
        ...player,
        hand: previousHand,
        removedCards: previousRemovedCards,
        crystals: previousCrystals ?? player.crystals,
        pendingDecompose: previousPendingDecompose,
      };

      const newState: GameState = {
        ...state,
        players: state.players.map((p, i) =>
          i === playerIndex ? restoredPlayer : p
        ),
      };

      return {
        state: newState,
        events: [],
      };
    },
  };
}

// ============================================================================
// HELPERS
// ============================================================================

const ALL_BASIC_COLORS: readonly BasicManaColor[] = [
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
];

/**
 * Convert card color to mana color.
 * Card colors and mana colors use the same string values ("red", "blue", etc.)
 * but this function provides a type-safe conversion.
 */
function cardColorToManaColor(
  cardColor: string
): BasicManaColor {
  switch (cardColor) {
    case "red":
      return MANA_RED;
    case "blue":
      return MANA_BLUE;
    case "green":
      return MANA_GREEN;
    case "white":
      return MANA_WHITE;
    default:
      throw new Error(`Unknown card color: ${cardColor}`);
  }
}

/**
 * Add crystals of the specified color (capped at 3 per color)
 */
function addCrystals(crystals: Crystals, color: BasicManaColor, count: number): Crystals {
  const current = crystals[color];
  const newValue = Math.min(current + count, 3);
  if (newValue === current) {
    return crystals;
  }
  return {
    ...crystals,
    [color]: newValue,
  };
}
