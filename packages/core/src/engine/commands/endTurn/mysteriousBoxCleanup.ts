/**
 * End-turn cleanup for Mysterious Box.
 *
 * Applies special card-fate rules and returns the revealed artifact to the
 * bottom of the artifact deck.
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { CardId } from "@mage-knight/shared";
import { CARD_MYSTERIOUS_BOX } from "@mage-knight/shared";

export interface MysteriousBoxCleanupResult {
  readonly state: GameState;
  readonly player: Player;
}

function removeCardOnce(cards: readonly CardId[], cardId: CardId): readonly CardId[] {
  const index = cards.indexOf(cardId);
  if (index === -1) {
    return cards;
  }
  return [...cards.slice(0, index), ...cards.slice(index + 1)];
}

export function processMysteriousBoxCleanup(
  state: GameState,
  player: Player
): MysteriousBoxCleanupResult {
  const boxState = player.mysteriousBoxState;
  if (!boxState) {
    return { state, player };
  }

  const revealedArtifactId = boxState.revealedArtifactId;
  let updatedPlayer: Player = {
    ...player,
    mysteriousBoxState: null,
  };

  // Remove any lingering temporary banner attachment before card flow.
  const hadBannerAttachment = updatedPlayer.attachedBanners.some(
    (attachment) => attachment.bannerId === CARD_MYSTERIOUS_BOX
  );
  if (hadBannerAttachment) {
    updatedPlayer = {
      ...updatedPlayer,
      attachedBanners: updatedPlayer.attachedBanners.filter(
        (attachment) => attachment.bannerId !== CARD_MYSTERIOUS_BOX
      ),
    };
  }

  switch (boxState.usedAs) {
    case "unused": {
      const playArea = removeCardOnce(updatedPlayer.playArea, CARD_MYSTERIOUS_BOX);
      const hand = playArea === updatedPlayer.playArea
        ? updatedPlayer.hand
        : [...updatedPlayer.hand, CARD_MYSTERIOUS_BOX];
      updatedPlayer = {
        ...updatedPlayer,
        playArea,
        hand,
      };
      break;
    }

    case "powered": {
      const playArea = removeCardOnce(updatedPlayer.playArea, CARD_MYSTERIOUS_BOX);
      const removedCards = updatedPlayer.removedCards.includes(CARD_MYSTERIOUS_BOX)
        ? updatedPlayer.removedCards
        : [...updatedPlayer.removedCards, CARD_MYSTERIOUS_BOX];
      updatedPlayer = {
        ...updatedPlayer,
        playArea,
        removedCards,
      };
      break;
    }

    case "banner": {
      const playArea = removeCardOnce(updatedPlayer.playArea, CARD_MYSTERIOUS_BOX);
      const discard = updatedPlayer.discard.includes(CARD_MYSTERIOUS_BOX)
        ? updatedPlayer.discard
        : [...updatedPlayer.discard, CARD_MYSTERIOUS_BOX];
      updatedPlayer = {
        ...updatedPlayer,
        playArea,
        discard,
      };
      break;
    }

    case "basic":
    default:
      // Basic use follows normal card flow from play area to discard.
      break;
  }

  const players = [...state.players];
  const playerIndex = players.findIndex((p) => p.id === updatedPlayer.id);
  if (playerIndex !== -1) {
    players[playerIndex] = updatedPlayer;
  }

  const updatedState: GameState = {
    ...state,
    players,
    decks: {
      ...state.decks,
      artifacts: [...state.decks.artifacts, revealedArtifactId],
    },
  };

  return { state: updatedState, player: updatedPlayer };
}
