/**
 * End combat phase command
 *
 * When combat ends with victory at a site:
 * - Triggers automatic conquest
 * - Clears enemies from hex
 *
 * Also resolves pending damage when transitioning out of RANGED_SIEGE or ATTACK phases.
 */

import type { Command, CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";

import { getNextPhase, handlePhaseTransition } from "./phaseTransitions.js";
import { handleCombatEnd } from "./combatEndHandlers.js";

export const END_COMBAT_PHASE_COMMAND = "END_COMBAT_PHASE" as const;

export interface EndCombatPhaseCommandParams {
  readonly playerId: string;
}

export function createEndCombatPhaseCommand(
  params: EndCombatPhaseCommandParams
): Command {
  return {
    type: END_COMBAT_PHASE_COMMAND,
    playerId: params.playerId,
    isReversible: false,

    execute(state: GameState): CommandResult {
      if (!state.combat) {
        throw new Error("Not in combat");
      }

      const currentPhase = state.combat.phase;
      const nextPhase = getNextPhase(currentPhase);

      // Combat ends after Attack phase
      if (nextPhase === null) {
        return handleCombatEnd(state, params.playerId);
      }

      // Advance to next phase
      return handlePhaseTransition(state, params.playerId, currentPhase, nextPhase);
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo END_COMBAT_PHASE");
    },
  };
}
