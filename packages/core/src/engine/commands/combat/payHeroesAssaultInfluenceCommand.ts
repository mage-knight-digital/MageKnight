/**
 * Pay Heroes Assault Influence Command
 *
 * Allows player to pay 2 Influence during a fortified site assault to enable
 * Heroes units to use their abilities for the rest of the combat.
 *
 * Per rulebook: Heroes cannot use abilities in fortified assaults unless
 * 2 Influence is paid once per combat. Damage assignment to Heroes is still
 * allowed without payment.
 *
 * @module engine/commands/combat/payHeroesAssaultInfluenceCommand
 */

import type { Command, CommandResult } from "../types.js";
import type { GameState } from "../../../state/GameState.js";
import { HEROES_ASSAULT_INFLUENCE_PAID } from "@mage-knight/shared";

export const PAY_HEROES_ASSAULT_INFLUENCE_COMMAND = "PAY_HEROES_ASSAULT_INFLUENCE" as const;

/** Cost in influence to enable Heroes abilities during fortified site assaults */
export const HEROES_ASSAULT_INFLUENCE_COST = 2;

export interface PayHeroesAssaultInfluenceCommandParams {
  readonly playerId: string;
}

export function createPayHeroesAssaultInfluenceCommand(
  params: PayHeroesAssaultInfluenceCommandParams
): Command {
  // Capture state for undo
  let previousInfluencePoints = 0;

  return {
    type: PAY_HEROES_ASSAULT_INFLUENCE_COMMAND,
    playerId: params.playerId,
    isReversible: true,

    execute(state: GameState): CommandResult {
      if (!state.combat) {
        throw new Error("Not in combat");
      }

      // Validate this is a fortified site assault
      if (!state.combat.isAtFortifiedSite || state.combat.assaultOrigin === null) {
        throw new Error("Not a fortified site assault - Heroes special rule does not apply");
      }

      // Validate not already paid
      if (state.combat.paidHeroesAssaultInfluence) {
        throw new Error("Heroes assault influence already paid this combat");
      }

      const player = state.players.find((p) => p.id === params.playerId);
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }
      const playerIndex = state.players.indexOf(player);

      // Validate player has enough influence
      if (player.influencePoints < HEROES_ASSAULT_INFLUENCE_COST) {
        throw new Error(
          `Insufficient influence (has ${player.influencePoints}, needs ${HEROES_ASSAULT_INFLUENCE_COST})`
        );
      }

      // Capture for undo
      previousInfluencePoints = player.influencePoints;

      // Deduct influence from player
      const updatedPlayers = state.players.map((p, i) =>
        i === playerIndex
          ? { ...p, influencePoints: p.influencePoints - HEROES_ASSAULT_INFLUENCE_COST }
          : p
      );

      // Mark influence as paid in combat state
      const updatedCombat = {
        ...state.combat,
        paidHeroesAssaultInfluence: true,
      };

      return {
        state: { ...state, players: updatedPlayers, combat: updatedCombat },
        events: [
          {
            type: HEROES_ASSAULT_INFLUENCE_PAID,
            playerId: params.playerId,
            influenceSpent: HEROES_ASSAULT_INFLUENCE_COST,
          },
        ],
      };
    },

    undo(state: GameState): CommandResult {
      if (!state.combat) {
        throw new Error("Not in combat (undo)");
      }

      const playerIndex = state.players.findIndex((p) => p.id === params.playerId);
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      // Restore player's influence
      const updatedPlayers = state.players.map((p, i) =>
        i === playerIndex ? { ...p, influencePoints: previousInfluencePoints } : p
      );

      // Mark as unpaid
      const updatedCombat = {
        ...state.combat,
        paidHeroesAssaultInfluence: false,
      };

      return {
        state: { ...state, players: updatedPlayers, combat: updatedCombat },
        events: [],
      };
    },
  };
}
