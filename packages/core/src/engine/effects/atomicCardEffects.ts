/**
 * Atomic card effect handlers
 *
 * Handles effects that modify the player's cards:
 * - DrawCards (draw from deck to hand)
 * - GainHealing (remove wounds from hand)
 * - TakeWound (add wounds to hand as a cost)
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { CardId } from "@mage-knight/shared";
import type { EffectResolutionResult } from "./types.js";
import { CARD_WOUND } from "@mage-knight/shared";
import { updatePlayer } from "./atomicHelpers.js";

// ============================================================================
// EFFECT HANDLERS
// ============================================================================

/**
 * Apply a DrawCards effect - draws cards from deck to hand.
 *
 * Per the rulebook, there is no mid-round reshuffle. If the deck
 * is empty, no cards are drawn.
 */
export function applyDrawCards(
  state: GameState,
  playerIndex: number,
  player: Player,
  amount: number
): EffectResolutionResult {
  const availableInDeck = player.deck.length;
  const actualDraw = Math.min(amount, availableInDeck);

  if (actualDraw === 0) {
    return { state, description: "No cards to draw" };
  }

  // Draw from top of deck to hand (no mid-round reshuffle per rulebook)
  const drawnCards = player.deck.slice(0, actualDraw);
  const newDeck = player.deck.slice(actualDraw);
  const newHand = [...player.hand, ...drawnCards];

  const updatedPlayer: Player = {
    ...player,
    deck: newDeck,
    hand: newHand,
  };

  const description =
    actualDraw === 1 ? "Drew 1 card" : `Drew ${actualDraw} cards`;

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description,
  };
}

/**
 * Apply a GainHealing effect - removes wounds from hand.
 *
 * Each healing point removes one wound card from hand.
 * Wounds are returned to the wound pile.
 */
export function applyGainHealing(
  state: GameState,
  playerIndex: number,
  player: Player,
  amount: number
): EffectResolutionResult {
  // Count wounds in hand
  const woundsInHand = player.hand.filter((c) => c === CARD_WOUND).length;

  if (woundsInHand === 0) {
    // No wounds to heal (shouldn't normally happen since isEffectResolvable checks this)
    return { state, description: "No wounds to heal" };
  }

  // Heal up to 'amount' wounds (each healing point removes one wound)
  const woundsToHeal = Math.min(amount, woundsInHand);

  // Remove wound cards from hand
  const newHand = [...player.hand];
  for (let i = 0; i < woundsToHeal; i++) {
    const woundIndex = newHand.indexOf(CARD_WOUND);
    if (woundIndex !== -1) {
      newHand.splice(woundIndex, 1);
    }
  }

  const updatedPlayer: Player = {
    ...player,
    hand: newHand,
  };

  // Return wounds to the wound pile (unlimited => stay null)
  const newWoundPileCount =
    state.woundPileCount === null ? null : state.woundPileCount + woundsToHeal;

  const updatedState = {
    ...updatePlayer(state, playerIndex, updatedPlayer),
    woundPileCount: newWoundPileCount,
  };

  const description =
    woundsToHeal === 1
      ? "Healed 1 wound"
      : `Healed ${woundsToHeal} wounds`;

  return {
    state: updatedState,
    description,
  };
}

/**
 * Apply a TakeWound effect - adds wound cards directly to hand.
 *
 * This is a COST, not combat damage - it bypasses armor.
 * Used by Fireball powered, Snowstorm powered, etc.
 */
export function applyTakeWound(
  state: GameState,
  playerIndex: number,
  player: Player,
  amount: number
): EffectResolutionResult {
  // Create wound cards to add to hand
  const woundsToAdd: CardId[] = Array(amount).fill(CARD_WOUND);

  const updatedPlayer: Player = {
    ...player,
    hand: [...player.hand, ...woundsToAdd],
  };

  // Decrement wound pile (if tracked)
  const newWoundPileCount =
    state.woundPileCount === null ? null : Math.max(0, state.woundPileCount - amount);

  const updatedState = {
    ...updatePlayer(state, playerIndex, updatedPlayer),
    woundPileCount: newWoundPileCount,
  };

  const description =
    amount === 1 ? "Took 1 wound" : `Took ${amount} wounds`;

  return {
    state: updatedState,
    description,
  };
}
