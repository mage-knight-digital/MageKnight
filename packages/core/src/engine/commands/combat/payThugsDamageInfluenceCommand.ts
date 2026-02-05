/**
 * Pay Thugs Damage Influence Command
 *
 * Allows player to pay 2 Influence during combat to enable damage
 * assignment to a specific Thugs unit for the rest of the combat.
 *
 * Per rulebook: Thugs are not willing to take damage unless you pay
 * 2 Influence during combat. Payment is per-unit, per-combat.
 *
 * @module engine/commands/combat/payThugsDamageInfluenceCommand
 */

import type { Command, CommandResult } from "../types.js";
import type { GameState } from "../../../state/GameState.js";
import { THUGS_DAMAGE_INFLUENCE_PAID } from "@mage-knight/shared";

export const PAY_THUGS_DAMAGE_INFLUENCE_COMMAND = "PAY_THUGS_DAMAGE_INFLUENCE" as const;

/** Cost in influence to enable damage assignment to a Thugs unit */
export const THUGS_DAMAGE_INFLUENCE_COST = 2;

export interface PayThugsDamageInfluenceCommandParams {
  readonly playerId: string;
  readonly unitInstanceId: string;
}

export function createPayThugsDamageInfluenceCommand(
  params: PayThugsDamageInfluenceCommandParams
): Command {
  // Capture state for undo
  let previousInfluencePoints = 0;

  return {
    type: PAY_THUGS_DAMAGE_INFLUENCE_COMMAND,
    playerId: params.playerId,
    isReversible: true,

    execute(state: GameState): CommandResult {
      if (!state.combat) {
        throw new Error("Not in combat");
      }

      // Validate not already paid for this unit
      if (state.combat.paidThugsDamageInfluence[params.unitInstanceId]) {
        throw new Error("Thugs damage influence already paid for this unit");
      }

      const player = state.players.find((p) => p.id === params.playerId);
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }
      const playerIndex = state.players.indexOf(player);

      // Validate player has enough influence
      if (player.influencePoints < THUGS_DAMAGE_INFLUENCE_COST) {
        throw new Error(
          `Insufficient influence (has ${player.influencePoints}, needs ${THUGS_DAMAGE_INFLUENCE_COST})`
        );
      }

      // Capture for undo
      previousInfluencePoints = player.influencePoints;

      // Deduct influence from player
      const updatedPlayers = state.players.map((p, i) =>
        i === playerIndex
          ? { ...p, influencePoints: p.influencePoints - THUGS_DAMAGE_INFLUENCE_COST }
          : p
      );

      // Mark influence as paid for this Thugs unit
      const updatedCombat = {
        ...state.combat,
        paidThugsDamageInfluence: {
          ...state.combat.paidThugsDamageInfluence,
          [params.unitInstanceId]: true,
        },
      };

      return {
        state: { ...state, players: updatedPlayers, combat: updatedCombat },
        events: [
          {
            type: THUGS_DAMAGE_INFLUENCE_PAID,
            playerId: params.playerId,
            unitInstanceId: params.unitInstanceId,
            influenceSpent: THUGS_DAMAGE_INFLUENCE_COST,
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

      // Remove payment record for this unit
      const remainingPayments = Object.fromEntries(
        Object.entries(state.combat.paidThugsDamageInfluence)
          .filter(([key]) => key !== params.unitInstanceId)
      );
      const updatedCombat = {
        ...state.combat,
        paidThugsDamageInfluence: remainingPayments,
      };

      return {
        state: { ...state, players: updatedPlayers, combat: updatedCombat },
        events: [],
      };
    },
  };
}
