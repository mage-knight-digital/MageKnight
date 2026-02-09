/**
 * Rush of Adrenaline effect handler
 *
 * Basic: For each of the first 3 wounds taken to hand this turn, draw a card. Retroactive.
 * Powered: Throw away first wound + draw 1, then draw 1 per wound (next 3). Retroactive.
 *
 * Resolution:
 * 1. Count wounds already taken this turn (retroactive handling)
 * 2. Immediately draw cards for wounds already taken
 * 3. Set up turn-scoped modifier for future wound triggers
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { RushOfAdrenalineEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { CARD_WOUND, CARD_RUSH_OF_ADRENALINE } from "@mage-knight/shared";
import { updatePlayer } from "./atomicHelpers.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { addModifier } from "../modifiers/index.js";
import { EFFECT_RUSH_OF_ADRENALINE } from "../../types/effectTypes.js";
import {
  DURATION_TURN,
  EFFECT_RUSH_OF_ADRENALINE_ACTIVE,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";

/**
 * Handle the Rush of Adrenaline effect.
 *
 * 1. Count wounds already taken to hand this turn
 * 2. Resolve retroactive draws/throws
 * 3. Add modifier for future wound triggers
 */
export function handleRushOfAdrenalineEffect(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: RushOfAdrenalineEffect
): EffectResolutionResult {
  const descriptions: string[] = [];
  let currentState = state;
  let currentPlayer = player;

  const woundsAlreadyTaken = currentPlayer.woundsReceivedThisTurn.hand;
  const isPowered = effect.mode === "powered";

  // Total draws available for the modifier
  const maxDraws = 3;
  let remainingDraws = maxDraws;
  let thrownFirstWound = false;

  if (woundsAlreadyTaken > 0) {
    // --- Retroactive resolution ---

    if (isPowered) {
      // Powered retroactive: throw away first wound + draw 1
      const woundIndex = currentPlayer.hand.indexOf(CARD_WOUND);
      if (woundIndex !== -1) {
        const newHand = [...currentPlayer.hand];
        newHand.splice(woundIndex, 1);
        currentPlayer = { ...currentPlayer, hand: newHand };

        // Return wound to pile
        const newWoundPileCount =
          currentState.woundPileCount === null
            ? null
            : currentState.woundPileCount + 1;

        currentState = {
          ...updatePlayer(currentState, playerIndex, currentPlayer),
          woundPileCount: newWoundPileCount,
        };
        currentPlayer = currentState.players[playerIndex]!;

        thrownFirstWound = true;

        // Draw 1 card for the thrown wound
        if (currentPlayer.deck.length > 0) {
          const drawnCard = currentPlayer.deck[0]!;
          currentPlayer = {
            ...currentPlayer,
            deck: currentPlayer.deck.slice(1),
            hand: [...currentPlayer.hand, drawnCard],
          };
          currentState = updatePlayer(currentState, playerIndex, currentPlayer);
          currentPlayer = currentState.players[playerIndex]!;
          descriptions.push("Threw away wound, drew 1 card (Rush of Adrenaline)");
        } else {
          descriptions.push("Threw away wound (Rush of Adrenaline, no cards to draw)");
        }
      }

      // Draw for remaining retroactive wounds (wounds after the first, up to 3)
      const retroactiveDraws = Math.min(woundsAlreadyTaken - 1, remainingDraws);
      if (retroactiveDraws > 0) {
        const availableInDeck = currentPlayer.deck.length;
        const actualDraw = Math.min(retroactiveDraws, availableInDeck);

        if (actualDraw > 0) {
          const drawnCards = currentPlayer.deck.slice(0, actualDraw);
          currentPlayer = {
            ...currentPlayer,
            deck: currentPlayer.deck.slice(actualDraw),
            hand: [...currentPlayer.hand, ...drawnCards],
          };
          currentState = updatePlayer(currentState, playerIndex, currentPlayer);
          currentPlayer = currentState.players[playerIndex]!;

          descriptions.push(
            actualDraw === 1
              ? "Drew 1 card (Rush of Adrenaline, retroactive)"
              : `Drew ${actualDraw} cards (Rush of Adrenaline, retroactive)`
          );
        }
        remainingDraws -= retroactiveDraws;
      }
    } else {
      // Basic retroactive: draw for wounds already taken (up to 3)
      const retroactiveDraws = Math.min(woundsAlreadyTaken, remainingDraws);
      if (retroactiveDraws > 0) {
        const availableInDeck = currentPlayer.deck.length;
        const actualDraw = Math.min(retroactiveDraws, availableInDeck);

        if (actualDraw > 0) {
          const drawnCards = currentPlayer.deck.slice(0, actualDraw);
          currentPlayer = {
            ...currentPlayer,
            deck: currentPlayer.deck.slice(actualDraw),
            hand: [...currentPlayer.hand, ...drawnCards],
          };
          currentState = updatePlayer(currentState, playerIndex, currentPlayer);
          currentPlayer = currentState.players[playerIndex]!;

          descriptions.push(
            actualDraw === 1
              ? "Drew 1 card (Rush of Adrenaline, retroactive)"
              : `Drew ${actualDraw} cards (Rush of Adrenaline, retroactive)`
          );
        }
        remainingDraws -= retroactiveDraws;
      }
    }
  }

  // Add modifier for future wound triggers (if draws remain)
  if (remainingDraws > 0) {
    currentState = addModifier(currentState, {
      source: {
        type: SOURCE_CARD,
        cardId: CARD_RUSH_OF_ADRENALINE,
        playerId: currentState.players[playerIndex]!.id,
      },
      duration: DURATION_TURN,
      scope: { type: SCOPE_SELF },
      effect: {
        type: EFFECT_RUSH_OF_ADRENALINE_ACTIVE,
        mode: effect.mode,
        remainingDraws,
        thrownFirstWound: isPowered ? thrownFirstWound : false,
      },
      createdAtRound: currentState.round,
      createdByPlayerId: currentState.players[playerIndex]!.id,
    });
  }

  const defaultDesc = isPowered
    ? "Rush of Adrenaline powered: wound-triggered card draws active"
    : "Rush of Adrenaline: wound-triggered card draws active";

  return {
    state: currentState,
    description: descriptions.length > 0
      ? descriptions.join(". ")
      : defaultDesc,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

export function registerRushOfAdrenalineEffects(): void {
  registerEffect(EFFECT_RUSH_OF_ADRENALINE, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return handleRushOfAdrenalineEffect(
      state,
      playerIndex,
      player,
      effect as RushOfAdrenalineEffect
    );
  });
}
