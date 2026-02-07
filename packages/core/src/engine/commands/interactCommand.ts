/**
 * INTERACT command - handles site interaction (healing, recruiting, etc.)
 *
 * Players can interact with inhabited sites to:
 * - Heal wounds (at villages/monasteries) by spending influence
 * - (Future) Buy spells, recruit units, etc.
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { CardId, GameEvent } from "@mage-knight/shared";
import {
  INTERACTION_STARTED,
  HEALING_PURCHASED,
  INTERACTION_COMPLETED,
  CARD_WOUND,
} from "@mage-knight/shared";
import { getPlayerSite } from "../helpers/siteHelpers.js";
import { getHealingCost } from "../../data/siteProperties.js";
import {
  getActiveInteractionBonus,
  getActiveInteractionBonusModifierIds,
} from "../rules/unitRecruitment.js";
import { applyChangeReputation, applyGainFame } from "../effects/atomicEffects.js";

export const INTERACT_COMMAND = "INTERACT" as const;

export interface InteractCommandParams {
  readonly playerId: string;
  readonly healing: number; // Healing points to buy
  readonly influenceAvailable: number; // Pre-calculated from cards
  readonly previousHand: readonly CardId[]; // For undo
}

export function createInteractCommand(params: InteractCommandParams): Command {
  return {
    type: INTERACT_COMMAND,
    playerId: params.playerId,
    isReversible: false, // Interaction commits resources

    execute(state: GameState): CommandResult {
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

      const site = getPlayerSite(state, params.playerId);
      if (!site) {
        throw new Error("Not at a site");
      }

      const events: GameEvent[] = [
        {
          type: INTERACTION_STARTED,
          playerId: params.playerId,
          siteType: site.type,
          influenceAvailable: params.influenceAvailable,
        },
      ];

      let updatedPlayer: Player = { ...player };
      let influenceRemaining = params.influenceAvailable;

      // Process healing
      if (params.healing > 0) {
        const healingCost = getHealingCost(site.type);
        if (healingCost === null) {
          throw new Error("Site doesn't offer healing");
        }

        // Count actual wounds in hand
        const woundsInHand = updatedPlayer.hand.filter(
          (c) => c === CARD_WOUND
        ).length;
        const actualHealingPoints = Math.min(params.healing, woundsInHand);

        // Only charge for wounds actually healed
        const totalCost = actualHealingPoints * healingCost;
        if (totalCost > influenceRemaining) {
          throw new Error("Not enough influence for healing");
        }

        influenceRemaining -= totalCost;

        // Remove wound cards from hand
        let woundsHealed = 0;
        const newHand = [...updatedPlayer.hand];

        for (let i = 0; i < actualHealingPoints; i++) {
          const woundIndex = newHand.indexOf(CARD_WOUND);
          if (woundIndex !== -1) {
            newHand.splice(woundIndex, 1);
            woundsHealed++;
          }
        }

        updatedPlayer = {
          ...updatedPlayer,
          hand: newHand,
          // Track wounds healed from hand this turn (for Cure spell)
          woundsHealedFromHandThisTurn: updatedPlayer.woundsHealedFromHandThisTurn + woundsHealed,
        };

        events.push({
          type: HEALING_PURCHASED,
          playerId: params.playerId,
          healingPoints: actualHealingPoints, // Actual, not requested
          influenceCost: totalCost,
          woundsHealed,
        });
      }

      // Mark player as having taken action
      updatedPlayer = { ...updatedPlayer, hasTakenActionThisTurn: true };

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      let updatedState: GameState = { ...state, players };

      // Check for active interaction bonus (Noble Manners)
      // Consumed on first interaction — only triggers once
      const interactionBonus = getActiveInteractionBonus(updatedState, params.playerId);
      if (interactionBonus) {
        const modifierIds = getActiveInteractionBonusModifierIds(updatedState, params.playerId);

        // Remove the interaction bonus modifiers (consumed)
        updatedState = {
          ...updatedState,
          activeModifiers: updatedState.activeModifiers.filter(
            (m) => !modifierIds.includes(m.id)
          ),
        };

        const ibPlayerIndex = updatedState.players.findIndex(
          (p) => p.id === params.playerId
        );
        const ibPlayer = updatedState.players[ibPlayerIndex];
        if (ibPlayer) {
          if (interactionBonus.fame > 0) {
            const fameResult = applyGainFame(
              updatedState,
              ibPlayerIndex,
              ibPlayer,
              interactionBonus.fame,
            );
            updatedState = fameResult.state;
          }

          if (interactionBonus.reputation !== 0) {
            const repPlayer = updatedState.players[ibPlayerIndex];
            if (repPlayer) {
              const repResult = applyChangeReputation(
                updatedState,
                ibPlayerIndex,
                repPlayer,
                interactionBonus.reputation,
              );
              updatedState = repResult.state;
            }
          }
        }
      }

      events.push({
        type: INTERACTION_COMPLETED,
        playerId: params.playerId,
        siteType: site.type,
      });

      return {
        state: updatedState,
        events,
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo INTERACT");
    },
  };
}
