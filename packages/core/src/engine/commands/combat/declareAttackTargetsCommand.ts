/**
 * Declare attack targets command
 *
 * Part of the target-first attack flow. Player declares which enemies
 * they intend to attack before playing cards/effects. Reversible.
 */

import type { Command, CommandResult } from "../types.js";
import type { GameState } from "../../../state/GameState.js";

export const DECLARE_ATTACK_TARGETS_COMMAND = "DECLARE_ATTACK_TARGETS" as const;

export interface DeclareAttackTargetsCommandParams {
  readonly playerId: string;
  readonly targetEnemyInstanceIds: readonly string[];
}

export function createDeclareAttackTargetsCommand(
  params: DeclareAttackTargetsCommandParams
): Command {
  return {
    type: DECLARE_ATTACK_TARGETS_COMMAND,
    playerId: params.playerId,
    isReversible: true,

    execute(state: GameState): CommandResult {
      const combat = state.combat;
      if (!combat) {
        throw new Error("Not in combat");
      }

      const updatedCombat = {
        ...combat,
        declaredAttackTargets: params.targetEnemyInstanceIds,
      };

      return {
        state: { ...state, combat: updatedCombat },
        events: [],
      };
    },

    undo(state: GameState): CommandResult {
      const combat = state.combat;
      if (!combat) {
        throw new Error("Not in combat");
      }

      // Remove declaredAttackTargets
      const updatedCombat = {
        ...combat,
        declaredAttackTargets: undefined,
      };

      return {
        state: { ...state, combat: updatedCombat },
        events: [],
      };
    },
  };
}
