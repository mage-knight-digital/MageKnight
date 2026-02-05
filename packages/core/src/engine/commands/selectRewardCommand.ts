/**
 * Select reward command - allows player to select a card from an offer
 * as a pending reward (spell, artifact, or advanced action).
 *
 * This command is irreversible (reward selection cannot be undone).
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { GameEvent, CardId } from "@mage-knight/shared";
import {
  REWARD_SELECTED,
  SITE_REWARD_SPELL,
  SITE_REWARD_ARTIFACT,
  SITE_REWARD_ADVANCED_ACTION,
} from "@mage-knight/shared";
import type { Player } from "../../types/player.js";
import { SELECT_REWARD_COMMAND } from "./commandTypes.js";

export { SELECT_REWARD_COMMAND };

export interface SelectRewardCommandParams {
  readonly playerId: string;
  readonly cardId: CardId;
  readonly rewardIndex: number; // Which pending reward to resolve (0 = first)
}

export function createSelectRewardCommand(
  params: SelectRewardCommandParams
): Command {
  return {
    type: SELECT_REWARD_COMMAND,
    playerId: params.playerId,
    isReversible: false, // Cannot undo reward selection

    execute(state: GameState): CommandResult {
      const player = state.players.find((p) => p.id === params.playerId);
      if (!player) {
        throw new Error("Player not found");
      }

      const reward = player.pendingRewards[params.rewardIndex];
      if (!reward) {
        throw new Error("No pending reward at index");
      }

      const events: GameEvent[] = [];
      let updatedState = state;

      // Handle based on reward type
      switch (reward.type) {
        case SITE_REWARD_SPELL: {
          // Take card from spell offer
          const spellOffer = state.offers.spells.cards;
          const offerIndex = spellOffer.indexOf(params.cardId);
          if (offerIndex === -1) {
            throw new Error("Selected card not in spell offer");
          }

          // Remove from offer
          const newOffer = [
            ...spellOffer.slice(0, offerIndex),
            ...spellOffer.slice(offerIndex + 1),
          ];

          // Replenish from deck if available
          let newDeck = state.decks.spells;
          let finalOffer = newOffer;
          if (newDeck.length > 0) {
            const newCard = newDeck[0];
            if (newCard) {
              finalOffer = [...newOffer, newCard];
              newDeck = newDeck.slice(1);
            }
          }

          // Add card to top of player's deed deck (will draw next round)
          const updatedPlayer: Player = {
            ...player,
            deck: [params.cardId, ...player.deck],
            pendingRewards: [
              ...player.pendingRewards.slice(0, params.rewardIndex),
              ...player.pendingRewards.slice(params.rewardIndex + 1),
            ],
          };

          updatedState = {
            ...state,
            players: state.players.map((p) =>
              p.id === params.playerId ? updatedPlayer : p
            ),
            offers: {
              ...state.offers,
              spells: { cards: finalOffer },
            },
            decks: {
              ...state.decks,
              spells: newDeck,
            },
          };

          events.push({
            type: REWARD_SELECTED,
            playerId: params.playerId,
            cardId: params.cardId,
            rewardType: SITE_REWARD_SPELL,
          });
          break;
        }

        case SITE_REWARD_ARTIFACT: {
          // Take card from artifact deck (artifacts go straight to player)
          const artifactDeck = state.decks.artifacts;
          const deckIndex = artifactDeck.indexOf(params.cardId);
          if (deckIndex === -1) {
            throw new Error("Selected card not in artifact deck");
          }

          // Remove from deck
          const newArtifactDeck = [
            ...artifactDeck.slice(0, deckIndex),
            ...artifactDeck.slice(deckIndex + 1),
          ];

          // Add card to top of player's deed deck (will draw next round)
          const updatedPlayer: Player = {
            ...player,
            deck: [params.cardId, ...player.deck],
            pendingRewards: [
              ...player.pendingRewards.slice(0, params.rewardIndex),
              ...player.pendingRewards.slice(params.rewardIndex + 1),
            ],
          };

          updatedState = {
            ...state,
            players: state.players.map((p) =>
              p.id === params.playerId ? updatedPlayer : p
            ),
            decks: {
              ...state.decks,
              artifacts: newArtifactDeck,
            },
          };

          events.push({
            type: REWARD_SELECTED,
            playerId: params.playerId,
            cardId: params.cardId,
            rewardType: SITE_REWARD_ARTIFACT,
          });
          break;
        }

        case SITE_REWARD_ADVANCED_ACTION: {
          // Take card from advanced action offer
          const aaOffer = state.offers.advancedActions.cards;
          const offerIndex = aaOffer.indexOf(params.cardId);
          if (offerIndex === -1) {
            throw new Error("Selected card not in advanced action offer");
          }

          // Remove from offer
          const newOffer = [
            ...aaOffer.slice(0, offerIndex),
            ...aaOffer.slice(offerIndex + 1),
          ];

          // Replenish from deck if available
          let newAADeck = state.decks.advancedActions;
          let finalOffer = newOffer;
          if (newAADeck.length > 0) {
            const newCard = newAADeck[0];
            if (newCard) {
              finalOffer = [...newOffer, newCard];
              newAADeck = newAADeck.slice(1);
            }
          }

          // Add card to top of player's deed deck (will draw next round)
          const updatedPlayer: Player = {
            ...player,
            deck: [params.cardId, ...player.deck],
            pendingRewards: [
              ...player.pendingRewards.slice(0, params.rewardIndex),
              ...player.pendingRewards.slice(params.rewardIndex + 1),
            ],
          };

          updatedState = {
            ...state,
            players: state.players.map((p) =>
              p.id === params.playerId ? updatedPlayer : p
            ),
            offers: {
              ...state.offers,
              advancedActions: { cards: finalOffer },
            },
            decks: {
              ...state.decks,
              advancedActions: newAADeck,
            },
          };

          events.push({
            type: REWARD_SELECTED,
            playerId: params.playerId,
            cardId: params.cardId,
            rewardType: SITE_REWARD_ADVANCED_ACTION,
          });
          break;
        }

        default:
          throw new Error(`Cannot select card for reward type: ${reward.type}`);
      }

      return {
        state: updatedState,
        events,
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo SELECT_REWARD");
    },
  };
}
