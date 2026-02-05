/**
 * Resolve Discard for Crystal Command
 *
 * Handles player resolution of a pending discard-for-crystal (Savage Harvesting).
 * When the player selects a card to discard:
 * - Action cards: automatically gain crystal matching the card's color
 * - Artifacts: transition to awaitingColorChoice state (second action needed)
 *
 * Flow:
 * 1. Card played creates pendingDiscardForCrystal via EFFECT_DISCARD_FOR_CRYSTAL
 * 2. Player sends RESOLVE_DISCARD_FOR_CRYSTAL action with selected cardId (or null to skip)
 * 3a. If action card: discard, gain crystal, clear pending state
 * 3b. If artifact: discard, set awaitingColorChoice=true (wait for color selection)
 *
 * This command is reversible since it's part of normal card play flow.
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { GameEvent, CardId, BasicManaColor } from "@mage-knight/shared";
import { createCardDiscardedEvent, MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE } from "@mage-knight/shared";
import type { Player, PendingDiscardForCrystal, Crystals } from "../../types/player.js";
import { RESOLVE_DISCARD_FOR_CRYSTAL_COMMAND } from "./commandTypes.js";
import { getCardsEligibleForDiscardForCrystal } from "../effects/discardForCrystalEffects.js";
import { getActionCardColor } from "../helpers/cardColor.js";

export { RESOLVE_DISCARD_FOR_CRYSTAL_COMMAND };

export interface ResolveDiscardForCrystalCommandParams {
  readonly playerId: string;
  /** Card ID to discard, or null to skip (if optional) */
  readonly cardId: CardId | null;
}

export function createResolveDiscardForCrystalCommand(
  params: ResolveDiscardForCrystalCommandParams
): Command {
  // Store previous state for undo
  let previousPendingDiscardForCrystal: PendingDiscardForCrystal | null = null;
  let previousHand: readonly CardId[] = [];
  let previousDiscard: readonly CardId[] = [];
  let previousCrystals: Crystals | null = null;

  return {
    type: RESOLVE_DISCARD_FOR_CRYSTAL_COMMAND,
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

      if (!player.pendingDiscardForCrystal) {
        throw new Error("No pending discard-for-crystal to resolve");
      }

      const pending = player.pendingDiscardForCrystal;

      // Store for undo
      previousPendingDiscardForCrystal = pending;
      previousHand = player.hand;
      previousDiscard = player.discard;
      previousCrystals = player.crystals;

      const events: GameEvent[] = [];

      // Handle skip (null cardId)
      if (params.cardId === null) {
        if (!pending.optional) {
          throw new Error(
            "Cannot skip discard: discard is required (not optional)"
          );
        }

        // Clear pending state and don't gain crystal
        const updatedPlayer: Player = {
          ...player,
          pendingDiscardForCrystal: null,
        };

        const newState: GameState = {
          ...state,
          players: state.players.map((p, i) =>
            i === playerIndex ? updatedPlayer : p
          ),
        };

        return {
          state: newState,
          events: [],
        };
      }

      // Validate card is eligible
      const eligibleCards = getCardsEligibleForDiscardForCrystal(player.hand);
      if (!eligibleCards.includes(params.cardId)) {
        throw new Error(
          `Card ${params.cardId} is not eligible for discard (either not in hand or is a wound)`
        );
      }

      // Remove card from hand
      const updatedHand = [...player.hand];
      const cardIndex = updatedHand.indexOf(params.cardId);
      if (cardIndex === -1) {
        throw new Error(`Card ${params.cardId} not found in hand`);
      }
      updatedHand.splice(cardIndex, 1);

      // Add to discard pile
      const updatedDiscardPile = [...player.discard, params.cardId];

      // Emit discard event
      events.push(createCardDiscardedEvent(params.playerId, params.cardId));

      // Try to get the action card color (works for basic/advanced action cards)
      const cardColor = getActionCardColor(params.cardId);

      if (!cardColor) {
        // Not an action card (artifact, spell, etc.) - need color selection (second step)
        const updatedPending: PendingDiscardForCrystal = {
          ...pending,
          discardedCardId: params.cardId,
          awaitingColorChoice: true,
        };

        const updatedPlayer: Player = {
          ...player,
          hand: updatedHand,
          discard: updatedDiscardPile,
          pendingDiscardForCrystal: updatedPending,
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
      }

      // Convert card color to mana color for crystal
      const manaColor = cardColorToManaColor(cardColor);

      // Grant crystal (capped at 3)
      const updatedCrystals = addCrystal(player.crystals, manaColor);

      // Clear pending state
      const updatedPlayer: Player = {
        ...player,
        hand: updatedHand,
        discard: updatedDiscardPile,
        crystals: updatedCrystals,
        pendingDiscardForCrystal: null,
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
        discard: previousDiscard,
        crystals: previousCrystals ?? player.crystals,
        pendingDiscardForCrystal: previousPendingDiscardForCrystal,
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

/**
 * Convert card color to mana color
 */
function cardColorToManaColor(
  cardColor: "red" | "blue" | "green" | "white"
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
  }
}

/**
 * Add a crystal of the specified color (capped at 3)
 */
function addCrystal(crystals: Crystals, color: BasicManaColor): Crystals {
  const current = crystals[color];
  if (current >= 3) {
    // Already at max - return unchanged
    return crystals;
  }
  return {
    ...crystals,
    [color]: current + 1,
  };
}
