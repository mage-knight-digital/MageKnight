/**
 * Monastery Helpers for Mage Knight
 *
 * Functions for managing monastery-related gameplay, including drawing
 * Advanced Actions when a monastery is discovered on tile reveal.
 */

import type { CardId } from "@mage-knight/shared";
import type { HexState } from "../../types/map.js";
import { SiteType } from "../../types/map.js";
import type { GameOffers } from "../../types/offers.js";
import type { GameDecks } from "../../types/decks.js";

// =============================================================================
// MONASTERY DETECTION
// =============================================================================

/**
 * Check if any of the given hexes contain a monastery site.
 * Used during tile exploration to determine if an AA should be drawn.
 */
export function hasMonasterySite(hexes: readonly HexState[]): boolean {
  return hexes.some((hex) => hex.site?.type === SiteType.Monastery);
}

/**
 * Count the number of monasteries in the given hexes.
 * For future-proofing if a tile could have multiple monasteries.
 */
export function countMonasteries(hexes: readonly HexState[]): number {
  return hexes.filter((hex) => hex.site?.type === SiteType.Monastery).length;
}

// =============================================================================
// MONASTERY AA DRAWING
// =============================================================================

export interface MonasteryAADrawResult {
  /** The card drawn for the monastery offer (null if deck was empty) */
  readonly cardId: CardId | null;
  /** Updated offers with the new monastery AA */
  readonly offers: GameOffers;
  /** Updated decks with the card removed from AA deck */
  readonly decks: GameDecks;
}

/**
 * Draw an Advanced Action from the deck and add it to the monastery offer.
 * Called when a tile with a monastery is explored.
 *
 * @param offers - Current game offers
 * @param decks - Current game decks
 * @returns Result containing drawn cardId (or null if deck empty), updated offers and decks
 */
export function drawMonasteryAdvancedAction(
  offers: GameOffers,
  decks: GameDecks
): MonasteryAADrawResult {
  // If AA deck is empty, return early with no changes
  if (decks.advancedActions.length === 0) {
    return {
      cardId: null,
      offers,
      decks,
    };
  }

  // Draw the top card from the AA deck
  const [drawnCard, ...remainingDeck] = decks.advancedActions;

  // Safety check (TypeScript narrowing)
  if (!drawnCard) {
    return {
      cardId: null,
      offers,
      decks,
    };
  }

  // Add the drawn card to the monastery offer
  const updatedOffers: GameOffers = {
    ...offers,
    monasteryAdvancedActions: [...offers.monasteryAdvancedActions, drawnCard],
  };

  // Remove the card from the deck
  const updatedDecks: GameDecks = {
    ...decks,
    advancedActions: remainingDeck,
  };

  return {
    cardId: drawnCard,
    offers: updatedOffers,
    decks: updatedDecks,
  };
}
