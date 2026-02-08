/**
 * Select reward command - allows player to select a card from an offer
 * as a pending reward (spell, artifact, or advanced action).
 *
 * This command is irreversible (reward selection cannot be undone).
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { GameEvent, CardId, UnitId } from "@mage-knight/shared";
import {
  REWARD_SELECTED,
  SITE_REWARD_SPELL,
  SITE_REWARD_ARTIFACT,
  SITE_REWARD_ADVANCED_ACTION,
  SITE_REWARD_UNIT,
  UNIT_DISBANDED,
  BANNER_DETACH_REASON_UNIT_DISBANDED,
} from "@mage-knight/shared";
import type { Player } from "../../types/player.js";
import { createPlayerUnit } from "../../types/unit.js";
import { removeUnitFromOffer } from "../../data/unitDeckSetup.js";
import { detachBannerFromUnit } from "./banners/bannerDetachment.js";
import { SELECT_REWARD_COMMAND } from "./commandTypes.js";

export { SELECT_REWARD_COMMAND };

let rewardUnitInstanceCounter = 0;

/** Reset the instance counter (for testing) */
export function resetRewardUnitInstanceCounter(): void {
  rewardUnitInstanceCounter = 0;
}

export interface SelectRewardCommandParams {
  readonly playerId: string;
  readonly cardId: CardId;
  readonly rewardIndex: number; // Which pending reward to resolve (0 = first)
  readonly unitId?: UnitId; // For unit rewards: the unit to recruit from offer
  readonly disbandUnitInstanceId?: string; // For unit rewards: unit to disband if at command limit
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

        case SITE_REWARD_UNIT: {
          // Free recruitment from unit offer (no influence cost)
          if (!params.unitId) {
            throw new Error("Unit reward requires unitId");
          }

          const unitOffer = state.offers.units;
          if (!unitOffer.includes(params.unitId)) {
            throw new Error("Selected unit not in unit offer");
          }

          const instanceId = `reward_unit_${++rewardUnitInstanceCounter}`;
          const newUnit = createPlayerUnit(params.unitId, instanceId);

          // Handle unit disband if at command limit
          let currentPlayer = player;
          const disbandEvents: GameEvent[] = [];
          if (params.disbandUnitInstanceId) {
            const disbandedUnit = currentPlayer.units.find(
              (u) => u.instanceId === params.disbandUnitInstanceId
            );

            if (disbandedUnit) {
              const bannerResult = detachBannerFromUnit(
                currentPlayer,
                params.disbandUnitInstanceId,
                BANNER_DETACH_REASON_UNIT_DISBANDED
              );

              currentPlayer = {
                ...currentPlayer,
                units: currentPlayer.units.filter(
                  (u) => u.instanceId !== params.disbandUnitInstanceId
                ),
                discard: bannerResult.updatedDiscard,
                attachedBanners: bannerResult.updatedAttachedBanners,
              };

              disbandEvents.push(
                { type: UNIT_DISBANDED, playerId: params.playerId, unitInstanceId: params.disbandUnitInstanceId },
                ...bannerResult.events
              );
            }
          }

          // Add unit to player, remove pending reward
          const updatedPlayerUnit: Player = {
            ...currentPlayer,
            units: [...currentPlayer.units, newUnit],
            pendingRewards: [
              ...currentPlayer.pendingRewards.slice(0, params.rewardIndex),
              ...currentPlayer.pendingRewards.slice(params.rewardIndex + 1),
            ],
          };

          // Remove unit from offer
          const updatedUnitOffer = removeUnitFromOffer(params.unitId, unitOffer);

          updatedState = {
            ...state,
            players: state.players.map((p) =>
              p.id === params.playerId ? updatedPlayerUnit : p
            ),
            offers: {
              ...state.offers,
              units: updatedUnitOffer,
            },
          };

          events.push(
            ...disbandEvents,
            {
              type: REWARD_SELECTED,
              playerId: params.playerId,
              cardId: params.cardId,
              rewardType: SITE_REWARD_UNIT,
            },
          );
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
