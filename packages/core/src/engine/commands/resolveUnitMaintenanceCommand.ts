/**
 * Resolve Unit Maintenance Command
 *
 * At the start of each round, players with Magic Familiars must either:
 * - Pay 1 crystal of any color to keep the unit (replace mana token)
 * - Disband the unit (remove from player's units)
 *
 * This happens before tactics selection.
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { BasicManaColor, GameEvent, UnitId } from "@mage-knight/shared";
import { UNIT_DISBANDED, UNIT_MAINTENANCE_PAID } from "@mage-knight/shared";
import { RESOLVE_UNIT_MAINTENANCE_COMMAND } from "./commandTypes.js";

export { RESOLVE_UNIT_MAINTENANCE_COMMAND };

export interface ResolveUnitMaintenanceParams {
  readonly playerId: string;
  readonly unitInstanceId: string;
  readonly keepUnit: boolean;
  readonly crystalColor?: BasicManaColor;
  readonly newManaTokenColor?: BasicManaColor;
}

export function createResolveUnitMaintenanceCommand(
  params: ResolveUnitMaintenanceParams
): Command {
  return {
    type: RESOLVE_UNIT_MAINTENANCE_COMMAND,
    playerId: params.playerId,
    isReversible: false, // Round-start processing, cannot undo

    execute(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      let player = state.players[playerIndex]!;
      const events: GameEvent[] = [];

      if (params.keepUnit) {
        // Pay crystal and replace mana token
        const color = params.crystalColor!;
        const newTokenColor = params.newManaTokenColor!;

        if (player.crystals[color] <= 0) {
          throw new Error(`No ${color} crystal available for maintenance`);
        }

        // Deduct crystal
        const updatedCrystals = {
          ...player.crystals,
          [color]: player.crystals[color] - 1,
        };

        // Replace mana token on the unit
        const updatedUnits = player.units.map((u) =>
          u.instanceId === params.unitInstanceId
            ? { ...u, manaToken: newTokenColor }
            : u
        );

        // Remove this unit from pending maintenance
        const updatedMaintenance = player.pendingUnitMaintenance
          ? player.pendingUnitMaintenance.filter(
              (m) => m.unitInstanceId !== params.unitInstanceId
            )
          : [];

        player = {
          ...player,
          crystals: updatedCrystals,
          units: updatedUnits,
          pendingUnitMaintenance:
            updatedMaintenance.length > 0 ? updatedMaintenance : null,
        };

        events.push({
          type: UNIT_MAINTENANCE_PAID,
          playerId: params.playerId,
          unitInstanceId: params.unitInstanceId,
          crystalColor: color,
          newManaTokenColor: newTokenColor,
        });
      } else {
        // Disband the unit
        const unit = player.units.find(
          (u) => u.instanceId === params.unitInstanceId
        );
        const unitId: UnitId = unit
          ? unit.unitId
          : (params.unitInstanceId as UnitId);

        // Remove unit from player's units
        const updatedUnits = player.units.filter(
          (u) => u.instanceId !== params.unitInstanceId
        );

        // Clear Bonds of Loyalty if this was the Bonds unit
        const updatedBondsId =
          player.bondsOfLoyaltyUnitInstanceId === params.unitInstanceId
            ? null
            : player.bondsOfLoyaltyUnitInstanceId;

        // Remove any attached banners
        const updatedBanners = player.attachedBanners.filter(
          (b) => b.unitInstanceId !== params.unitInstanceId
        );

        // Remove this unit from pending maintenance
        const updatedMaintenance = player.pendingUnitMaintenance
          ? player.pendingUnitMaintenance.filter(
              (m) => m.unitInstanceId !== params.unitInstanceId
            )
          : [];

        player = {
          ...player,
          units: updatedUnits,
          bondsOfLoyaltyUnitInstanceId: updatedBondsId,
          attachedBanners: updatedBanners,
          pendingUnitMaintenance:
            updatedMaintenance.length > 0 ? updatedMaintenance : null,
        };

        events.push({
          type: UNIT_DISBANDED,
          playerId: params.playerId,
          unitInstanceId: params.unitInstanceId,
          unitId,
        });
      }

      const players = state.players.map((p, i) =>
        i === playerIndex ? player : p
      );

      return {
        state: { ...state, players },
        events,
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo RESOLVE_UNIT_MAINTENANCE");
    },
  };
}
