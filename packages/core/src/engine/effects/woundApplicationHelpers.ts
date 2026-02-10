import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { CardId } from "@mage-knight/shared";
import { CARD_WOUND } from "@mage-knight/shared";
import {
  discardNonWoundsFromHand,
  isKnockoutTriggered,
} from "../rules/knockout.js";

/**
 * Apply wounds to hand from non-enemy sources (card/effect costs and effects).
 *
 * If this happens during combat for the active player, wounds contribute to
 * combat knockout tracking (FAQ: self-inflicted wounds during combat count).
 */
export function applyWoundsToHand(
  state: GameState,
  playerIndex: number,
  amount: number
): GameState {
  if (amount <= 0) {
    return state;
  }

  const player = state.players[playerIndex];
  if (!player) {
    return state;
  }

  const woundsToAdd: CardId[] = Array(amount).fill(CARD_WOUND);
  let updatedPlayer: Player = {
    ...player,
    hand: [...player.hand, ...woundsToAdd],
    woundsReceivedThisTurn: {
      hand: player.woundsReceivedThisTurn.hand + amount,
      discard: player.woundsReceivedThisTurn.discard,
    },
  };

  let updatedCombat = state.combat;
  const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
  const isCurrentCombatPlayer =
    updatedCombat !== null && currentPlayerId === player.id;

  if (updatedCombat !== null && isCurrentCombatPlayer) {
    const totalWoundsThisCombat = updatedCombat.woundsThisCombat + amount;
    const knockedOut = isKnockoutTriggered(
      totalWoundsThisCombat,
      player.handLimit
    );

    if (knockedOut) {
      const knockoutCards = discardNonWoundsFromHand(
        updatedPlayer.hand,
        updatedPlayer.discard
      );
      updatedPlayer = {
        ...updatedPlayer,
        hand: knockoutCards.hand,
        discard: knockoutCards.discard,
        knockedOut: true,
      };
    }

    updatedCombat = {
      ...updatedCombat,
      woundsThisCombat: totalWoundsThisCombat,
      woundsAddedToHandThisCombat:
        updatedCombat.woundsAddedToHandThisCombat || amount > 0,
    };
  }

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = updatedPlayer;

  const newWoundPileCount =
    state.woundPileCount === null
      ? null
      : Math.max(0, state.woundPileCount - amount);

  return {
    ...state,
    players: updatedPlayers,
    combat: updatedCombat,
    woundPileCount: newWoundPileCount,
  };
}
