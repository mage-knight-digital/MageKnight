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
import type { EffectResolutionResult } from "./types.js";
import { CARD_WOUND } from "@mage-knight/shared";
import { updatePlayer } from "./atomicHelpers.js";
import { isCureActive } from "./cureHelpers.js";
import {
  getGoldenGrailFameTracker,
  calculateGrailFame,
  updateGrailFameTracker,
  isGoldenGrailDrawOnHealActive,
} from "./goldenGrailHelpers.js";
import { applyGainFame } from "./atomicProgressionEffects.js";
import { processRushOfAdrenalineOnWound } from "./rushOfAdrenalineHelpers.js";
import { applyWoundsToHand } from "./woundApplicationHelpers.js";

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
    // Track wounds healed from hand this turn (for Cure spell)
    woundsHealedFromHandThisTurn: player.woundsHealedFromHandThisTurn + woundsToHeal,
  };

  // Return wounds to the wound pile (unlimited => stay null)
  const newWoundPileCount =
    state.woundPileCount === null ? null : state.woundPileCount + woundsToHeal;

  let updatedState: GameState = {
    ...updatePlayer(state, playerIndex, updatedPlayer),
    woundPileCount: newWoundPileCount,
  };

  const descriptions: string[] = [
    woundsToHeal === 1
      ? "Healed 1 wound"
      : `Healed ${woundsToHeal} wounds`,
  ];

  // If Cure is active, draw a card for each wound just healed
  if (isCureActive(state, player.id)) {
    const currentPlayer = updatedState.players[playerIndex]!;
    const availableInDeck = currentPlayer.deck.length;
    const cardsToDraw = Math.min(woundsToHeal, availableInDeck);

    if (cardsToDraw > 0) {
      const drawnCards = currentPlayer.deck.slice(0, cardsToDraw);
      const newDeck = currentPlayer.deck.slice(cardsToDraw);
      const drawnHand = [...currentPlayer.hand, ...drawnCards];

      updatedState = updatePlayer(updatedState, playerIndex, {
        ...currentPlayer,
        hand: drawnHand,
        deck: newDeck,
      });

      descriptions.push(
        cardsToDraw === 1
          ? "Drew 1 card (Cure)"
          : `Drew ${cardsToDraw} cards (Cure)`
      );
    }
  }

  // Golden Grail fame tracking: award Fame +1 per healing point from the Grail spent
  const grailFameTracker = getGoldenGrailFameTracker(state, player.id);
  if (grailFameTracker) {
    const fameToAward = calculateGrailFame(grailFameTracker, woundsToHeal);
    if (fameToAward > 0) {
      // Update the tracker first (decrement remaining)
      updatedState = updateGrailFameTracker(updatedState, grailFameTracker, fameToAward);
      // Then award fame
      const currentPlayer = updatedState.players[playerIndex]!;
      const fameResult = applyGainFame(updatedState, playerIndex, currentPlayer, fameToAward);
      updatedState = fameResult.state;

      descriptions.push(
        fameToAward === 1
          ? "Fame +1 (Golden Grail)"
          : `Fame +${fameToAward} (Golden Grail)`
      );
    }
  }

  // Golden Grail draw-on-heal: draw a card each time a wound is healed from hand
  if (isGoldenGrailDrawOnHealActive(state, player.id)) {
    const currentPlayer = updatedState.players[playerIndex]!;
    const availableInDeck = currentPlayer.deck.length;
    const cardsToDraw = Math.min(woundsToHeal, availableInDeck);

    if (cardsToDraw > 0) {
      const drawnCards = currentPlayer.deck.slice(0, cardsToDraw);
      const newDeck = currentPlayer.deck.slice(cardsToDraw);
      const drawnHand = [...currentPlayer.hand, ...drawnCards];

      updatedState = updatePlayer(updatedState, playerIndex, {
        ...currentPlayer,
        hand: drawnHand,
        deck: newDeck,
      });

      descriptions.push(
        cardsToDraw === 1
          ? "Drew 1 card (Golden Grail)"
          : `Drew ${cardsToDraw} cards (Golden Grail)`
      );
    }
  }

  return {
    state: updatedState,
    description: descriptions.join(". "),
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
  let updatedState = applyWoundsToHand(state, playerIndex, amount);

  const descriptions: string[] = [
    amount === 1 ? "Took 1 wound" : `Took ${amount} wounds`,
  ];

  // Rush of Adrenaline: draw cards when wounds are taken to hand
  const rushResult = processRushOfAdrenalineOnWound(
    updatedState,
    playerIndex,
    updatedState.players[playerIndex]!,
    amount
  );
  updatedState = rushResult.state;
  descriptions.push(...rushResult.descriptions);

  return {
    state: updatedState,
    description: descriptions.join(". "),
  };
}
