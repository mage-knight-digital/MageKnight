/**
 * Declare block target command
 *
 * Part of the target-first block flow. Player declares which enemy
 * they intend to block before assigning block. Reversible.
 */

import type { Command, CommandResult } from "../types.js";
import type { GameState } from "../../../state/GameState.js";

export const DECLARE_BLOCK_TARGET_COMMAND = "DECLARE_BLOCK_TARGET" as const;

export interface DeclareBlockTargetCommandParams {
  readonly playerId: string;
  readonly targetEnemyInstanceId: string;
  readonly attackIndex?: number;
}

export function createDeclareBlockTargetCommand(
  params: DeclareBlockTargetCommandParams
): Command {
  return {
    type: DECLARE_BLOCK_TARGET_COMMAND,
    playerId: params.playerId,
    isReversible: true,

    execute(state: GameState): CommandResult {
      const combat = state.combat;
      if (!combat) {
        throw new Error("Not in combat");
      }

      const updatedCombat = {
        ...combat,
        declaredBlockTarget: params.targetEnemyInstanceId,
        ...(params.attackIndex !== undefined
          ? { declaredBlockAttackIndex: params.attackIndex }
          : {}),
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

      const updatedCombat = {
        ...combat,
        declaredBlockTarget: undefined,
        declaredBlockAttackIndex: undefined,
      };

      return {
        state: { ...state, combat: updatedCombat },
        events: [],
      };
    },
  };
}
