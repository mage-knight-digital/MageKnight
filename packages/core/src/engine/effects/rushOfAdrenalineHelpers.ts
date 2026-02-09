/**
 * Rush of Adrenaline helper functions
 *
 * Query and update functions for the Rush of Adrenaline wound-triggered draw modifier.
 *
 * Basic: Draw 1 card per wound taken to hand (first 3 this turn). Retroactive.
 * Powered: Throw away first wound + draw 1, then draw 1 per wound (next 3). Retroactive.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { ActiveModifier, RushOfAdrenalineActiveModifier } from "../../types/modifiers.js";
import { CARD_WOUND } from "@mage-knight/shared";
import { EFFECT_RUSH_OF_ADRENALINE_ACTIVE } from "../../types/modifierConstants.js";
import { getModifiersForPlayer } from "../modifiers/queries.js";
import { removeModifier } from "../modifiers/lifecycle.js";

/**
 * Get the Rush of Adrenaline active modifier for a player, if present.
 */
export function getRushOfAdrenalineModifier(
  state: GameState,
  playerId: string
): ActiveModifier | undefined {
  const modifiers = getModifiersForPlayer(state, playerId);
  return modifiers.find(
    (m) => m.effect.type === EFFECT_RUSH_OF_ADRENALINE_ACTIVE
  );
}

/**
 * Get the typed effect from a Rush of Adrenaline modifier.
 */
function getEffect(modifier: ActiveModifier): RushOfAdrenalineActiveModifier {
  return modifier.effect as RushOfAdrenalineActiveModifier;
}

export interface RushOfAdrenalineWoundResult {
  readonly state: GameState;
  readonly player: Player;
  readonly descriptions: readonly string[];
}

/**
 * Process Rush of Adrenaline triggers when wounds are added to hand.
 *
 * Called from wound-taking functions (applyTakeWound, applyHeroWounds).
 * Handles both basic and powered modes, including the powered throw-away mechanic.
 *
 * @param state - Current game state (with wounds already added to hand)
 * @param playerIndex - Index of the player
 * @param player - Player state (with wounds already in hand)
 * @param woundsJustTaken - Number of wounds just taken to hand
 * @returns Updated state, player, and description strings
 */
export function processRushOfAdrenalineOnWound(
  state: GameState,
  playerIndex: number,
  player: Player,
  woundsJustTaken: number
): RushOfAdrenalineWoundResult {
  const modifier = getRushOfAdrenalineModifier(state, player.id);
  if (!modifier || woundsJustTaken <= 0) {
    return { state, player, descriptions: [] };
  }

  const effect = getEffect(modifier);
  const descriptions: string[] = [];
  let currentState = state;
  let currentPlayer = player;
  let remainingDraws = effect.remainingDraws;
  let thrownFirstWound = effect.thrownFirstWound;
  let woundsToProcess = woundsJustTaken;

  // Powered mode: throw away first wound if not yet thrown
  if (effect.mode === "powered" && !thrownFirstWound && woundsToProcess > 0) {
    // Remove one wound from hand (throw it away — return to wound pile)
    const woundIndex = currentPlayer.hand.indexOf(CARD_WOUND);
    if (woundIndex !== -1) {
      const newHand = [...currentPlayer.hand];
      newHand.splice(woundIndex, 1);
      currentPlayer = {
        ...currentPlayer,
        hand: newHand,
      };

      // Return wound to pile
      const newWoundPileCount =
        currentState.woundPileCount === null
          ? null
          : currentState.woundPileCount + 1;

      currentState = {
        ...currentState,
        woundPileCount: newWoundPileCount,
        players: currentState.players.map((p, i) =>
          i === playerIndex ? currentPlayer : p
        ),
      };

      thrownFirstWound = true;
      woundsToProcess -= 1;

      // Draw 1 card for the thrown wound
      const availableInDeck = currentPlayer.deck.length;
      if (availableInDeck > 0) {
        const drawnCard = currentPlayer.deck[0]!;
        currentPlayer = {
          ...currentPlayer,
          deck: currentPlayer.deck.slice(1),
          hand: [...currentPlayer.hand, drawnCard],
        };
        currentState = {
          ...currentState,
          players: currentState.players.map((p, i) =>
            i === playerIndex ? currentPlayer : p
          ),
        };
        descriptions.push("Threw away wound, drew 1 card (Rush of Adrenaline)");
      } else {
        descriptions.push("Threw away wound (Rush of Adrenaline, no cards to draw)");
      }
    }
  }

  // Draw cards for remaining wounds (up to remainingDraws)
  if (woundsToProcess > 0 && remainingDraws > 0) {
    const drawCount = Math.min(woundsToProcess, remainingDraws);
    const availableInDeck = currentPlayer.deck.length;
    const actualDraw = Math.min(drawCount, availableInDeck);

    if (actualDraw > 0) {
      const drawnCards = currentPlayer.deck.slice(0, actualDraw);
      currentPlayer = {
        ...currentPlayer,
        deck: currentPlayer.deck.slice(actualDraw),
        hand: [...currentPlayer.hand, ...drawnCards],
      };
      currentState = {
        ...currentState,
        players: currentState.players.map((p, i) =>
          i === playerIndex ? currentPlayer : p
        ),
      };

      descriptions.push(
        actualDraw === 1
          ? "Drew 1 card (Rush of Adrenaline)"
          : `Drew ${actualDraw} cards (Rush of Adrenaline)`
      );
    }

    remainingDraws -= drawCount;
  }

  // Update or remove the modifier
  if (remainingDraws <= 0 && (effect.mode === "basic" || thrownFirstWound)) {
    currentState = removeModifier(currentState, modifier.id);
  } else {
    currentState = {
      ...currentState,
      activeModifiers: currentState.activeModifiers.map((m) =>
        m.id === modifier.id
          ? {
              ...m,
              effect: {
                ...effect,
                remainingDraws,
                thrownFirstWound,
              },
            }
          : m
      ),
    };
  }

  return { state: currentState, player: currentPlayer, descriptions };
}
