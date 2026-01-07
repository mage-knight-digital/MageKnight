/**
 * Enter combat command
 */

import type { Command, CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";
import type { EnemyId } from "@mage-knight/shared";
import { COMBAT_STARTED, createCombatExitedEvent } from "@mage-knight/shared";
import { createCombatState } from "../../../types/combat.js";

export const ENTER_COMBAT_COMMAND = "ENTER_COMBAT" as const;

export interface EnterCombatCommandParams {
  readonly playerId: string;
  readonly enemyIds: readonly EnemyId[];
  readonly isAtFortifiedSite?: boolean; // Optional: site provides fortification
}

export function createEnterCombatCommand(
  params: EnterCombatCommandParams
): Command {
  return {
    type: ENTER_COMBAT_COMMAND,
    playerId: params.playerId,
    // Entering combat is reversible - enemies were already visible on the map.
    // Checkpoints happen when new info is revealed (summoner draws, dice rolls, etc.)
    isReversible: true,

    execute(state: GameState): CommandResult {
      const combat = createCombatState(
        params.enemyIds,
        params.isAtFortifiedSite ?? false
      );

      return {
        state: { ...state, combat },
        events: [
          {
            type: COMBAT_STARTED,
            playerId: params.playerId,
            enemies: combat.enemies.map((e) => ({
              instanceId: e.instanceId,
              name: e.definition.name,
              attack: e.definition.attack,
              armor: e.definition.armor,
            })),
          },
        ],
      };
    },

    undo(state: GameState): CommandResult {
      // Simply exit combat - enemies go back to map (they were never "drawn")
      return {
        state: { ...state, combat: null },
        events: [createCombatExitedEvent(params.playerId, "undo")],
      };
    },
  };
}
