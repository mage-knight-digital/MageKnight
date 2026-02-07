/**
 * Choose Level Up Rewards Command
 *
 * Handles player selection of skill and advanced action when reaching an even level.
 *
 * Skill selection mechanics (per Mage Knight rules):
 * - 2 skills drawn from hero's remaining pool
 * - Choose one from: drawn pair OR common pool
 * - Rejected skill(s) go to common pool:
 *   - If picking from drawn pair: the other drawn skill goes to common pool
 *   - If picking from common pool: BOTH drawn skills go to common pool
 *
 * @module commands/chooseLevelUpRewardsCommand
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { GameEvent, CardId, SkillId } from "@mage-knight/shared";
import { SKILL_GAINED, ADVANCED_ACTION_GAINED } from "@mage-knight/shared";
import { getEndTurnDrawLimit } from "../helpers/handLimitHelpers.js";
import { SKILL_NOROWAS_BONDS_OF_LOYALTY } from "../../data/skills/norowas/bondsOfLoyalty.js";
import { shuffleWithRng } from "../../utils/rng.js";

export const CHOOSE_LEVEL_UP_REWARDS_COMMAND = "CHOOSE_LEVEL_UP_REWARDS" as const;

export interface ChooseLevelUpRewardsParams {
  readonly playerId: string;
  readonly level: number;
  readonly skillChoice: {
    readonly fromCommonPool: boolean;
    readonly skillId: SkillId;
  };
  readonly advancedActionId: CardId;
}

export function createChooseLevelUpRewardsCommand(
  params: ChooseLevelUpRewardsParams
): Command {
  return {
    type: CHOOSE_LEVEL_UP_REWARDS_COMMAND,
    playerId: params.playerId,
    isReversible: false, // Level up rewards are irreversible

    execute(state: GameState): CommandResult {
      const events: GameEvent[] = [];

      // Find player
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found at index: ${playerIndex}`);
      }

      // Find the pending reward for this level
      const rewardIndex = player.pendingLevelUpRewards.findIndex(
        (r) => r.level === params.level
      );
      if (rewardIndex === -1) {
        throw new Error(
          `No pending level up reward for level ${params.level}`
        );
      }

      const pendingReward = player.pendingLevelUpRewards[rewardIndex];
      if (!pendingReward) {
        throw new Error(`Pending reward not found at index: ${rewardIndex}`);
      }

      // Validate skill choice
      const { skillChoice, advancedActionId } = params;
      let updatedCommonSkills = [...state.offers.commonSkills];

      if (skillChoice.fromCommonPool) {
        // Picking from common pool - both drawn skills go to common pool
        if (!updatedCommonSkills.includes(skillChoice.skillId)) {
          throw new Error(
            `Skill ${skillChoice.skillId} not in common pool`
          );
        }
        // Remove selected skill from common pool
        updatedCommonSkills = updatedCommonSkills.filter(
          (s) => s !== skillChoice.skillId
        );
        // Add BOTH drawn skills to common pool
        updatedCommonSkills.push(...pendingReward.drawnSkills);
      } else {
        // Picking from drawn skills - the other drawn skill goes to common pool
        if (!pendingReward.drawnSkills.includes(skillChoice.skillId)) {
          throw new Error(
            `Skill ${skillChoice.skillId} not in drawn skills`
          );
        }
        // Add the rejected skill (the one not selected) to common pool
        const rejectedSkills = pendingReward.drawnSkills.filter(
          (s) => s !== skillChoice.skillId
        );
        updatedCommonSkills.push(...rejectedSkills);
      }

      // Validate AA choice
      if (!state.offers.advancedActions.cards.includes(advancedActionId)) {
        throw new Error(
          `Advanced action ${advancedActionId} not in offer`
        );
      }

      // Update player: add skill, add AA to top of deck, remove pending reward
      const currentDeck = player.deck ?? [];
      let deckWithAA = [advancedActionId, ...currentDeck];
      let handAfterDraw = [...player.hand];

      // Draw cards up to hand limit now that AA is on the deck
      const effectiveLimit = getEndTurnDrawLimit(state, player.id, handAfterDraw.length);
      const cardsToDraw = Math.max(0, effectiveLimit - handAfterDraw.length);

      for (let i = 0; i < cardsToDraw && deckWithAA.length > 0; i++) {
        const drawnCard = deckWithAA.shift();
        if (drawnCard) {
          handAfterDraw.push(drawnCard);
        }
      }

      const updatedPlayer: Player = {
        ...player,
        skills: [...player.skills, skillChoice.skillId],
        // AA goes to top of deck, then draw up to hand limit
        deck: deckWithAA,
        hand: handAfterDraw,
        pendingLevelUpRewards: player.pendingLevelUpRewards.filter(
          (r) => r.level !== params.level
        ),
      };

      // Update AA offer: remove selected card and replenish from deck
      const updatedAACards = state.offers.advancedActions.cards.filter(
        (c) => c !== advancedActionId
      );

      // Replenish from AA deck if possible
      const updatedAADeck = [...state.decks.advancedActions];
      if (updatedAADeck.length > 0) {
        const newCard = updatedAADeck.shift();
        if (newCard) {
          updatedAACards.unshift(newCard); // Add to beginning (top of offer)
        }
      }

      // Build updated state
      const updatedPlayers = [...state.players];
      updatedPlayers[playerIndex] = updatedPlayer;

      let updatedUnits = [...state.offers.units];
      let updatedRegularUnitsDeck = [...(state.decks.regularUnits ?? [])];
      let bondsOfLoyaltyBonusUnits = [...(state.offers.bondsOfLoyaltyBonusUnits ?? [])];
      let updatedRng = state.rng;

      // Bonds of Loyalty: add 2 random regular units to the Unit Offer
      if (skillChoice.skillId === SKILL_NOROWAS_BONDS_OF_LOYALTY) {
        const { result: shuffled, rng: rng2 } = shuffleWithRng(
          updatedRegularUnitsDeck,
          updatedRng
        );
        updatedRng = rng2;
        const bonusCount = Math.min(2, shuffled.length);
        const bonusUnits = shuffled.slice(0, bonusCount);
        updatedRegularUnitsDeck = shuffled.slice(bonusCount);

        updatedUnits = [...updatedUnits, ...bonusUnits];
        bondsOfLoyaltyBonusUnits = [...bondsOfLoyaltyBonusUnits, ...bonusUnits];
      }

      const newState: GameState = {
        ...state,
        players: updatedPlayers,
        offers: {
          ...state.offers,
          commonSkills: updatedCommonSkills,
          advancedActions: {
            ...state.offers.advancedActions,
            cards: updatedAACards,
          },
          units: updatedUnits,
          bondsOfLoyaltyBonusUnits,
        },
        decks: {
          ...state.decks,
          advancedActions: updatedAADeck,
          regularUnits: updatedRegularUnitsDeck,
        },
        rng: updatedRng,
      };

      // Emit events
      events.push({
        type: SKILL_GAINED,
        playerId: params.playerId,
        skillId: skillChoice.skillId,
      });

      events.push({
        type: ADVANCED_ACTION_GAINED,
        playerId: params.playerId,
        cardId: advancedActionId,
      });

      return { state: newState, events };
    },

    undo(_state: GameState): CommandResult {
      // This command is not reversible
      throw new Error("Cannot undo level up rewards selection");
    },
  };
}
