/**
 * Valid actions computation.
 *
 * This module is the single source of truth for what actions a player can take.
 * It computes ValidActions server-side and sends them to clients.
 */

import type { GameState } from "../../state/GameState.js";
import type { ValidActions, TacticsOptions } from "@mage-knight/shared";
import {
  checkCanAct,
  isInCombat,
  hasPendingChoice,
  isTacticsPhase,
} from "./helpers.js";
import { getTurnOptions } from "./turn.js";

// Re-export helpers for use in other modules
export {
  checkCanAct,
  isInCombat,
  hasPendingChoice,
  isTacticsPhase,
  isPlayerTurnsPhase,
  isOnMap,
  getCurrentPlayerId,
} from "./helpers.js";

// Re-export turn options
export { getTurnOptions } from "./turn.js";

/**
 * Compute all valid actions for a player.
 *
 * This is the main entry point called by toClientState().
 */
export function getValidActions(
  state: GameState,
  playerId: string
): ValidActions {
  // Check if player can act at all
  const canActResult = checkCanAct(state, playerId);

  if (!canActResult.canAct) {
    return {
      canAct: false,
      reason: canActResult.reason,
    };
  }

  const player = canActResult.player;

  // Handle tactics selection phase
  if (isTacticsPhase(state)) {
    return {
      canAct: true,
      tactics: getTacticsOptions(state, playerId),
    };
  }

  // Handle pending choice - must resolve before other actions
  if (hasPendingChoice(player)) {
    return {
      canAct: true,
      // Only turn options (undo) available during pending choice
      turn: {
        canEndTurn: false,
        canAnnounceEndOfRound: false,
        canUndo: getTurnOptions(state, player).canUndo,
        canRest: false,
        restTypes: undefined,
      },
    };
  }

  // Handle combat
  if (isInCombat(state)) {
    const combatOptions = getCombatOptionsPlaceholder(state);
    if (combatOptions) {
      return {
        canAct: true,
        combat: combatOptions,
        turn: {
          canEndTurn: false,
          canAnnounceEndOfRound: false,
          canUndo: getTurnOptions(state, player).canUndo,
          canRest: false,
          restTypes: undefined,
        },
        // TODO: playCard options for combat
        // TODO: unit activation options for combat
        // TODO: mana options
      };
    }
  }

  // Normal turn - compute all options
  // For Phase 1, we provide turn options and placeholders for others
  return {
    canAct: true,
    // TODO Phase 2: move: getValidMoveTargets(state, player),
    // TODO Phase 2: explore: getValidExploreDirections(state, player),
    // TODO Phase 3: playCard: getPlayableCards(state, player),
    // TODO Phase 3: mana: getManaOptions(state, player),
    // TODO Phase 6: units: getUnitOptions(state, player),
    // TODO Phase 6: sites: getSiteOptions(state, player),
    // TODO: enterCombat: getEnterCombatOptions(state, player),
    turn: getTurnOptions(state, player),
  };
}

/**
 * Get tactics selection options during tactics phase.
 */
function getTacticsOptions(
  state: GameState,
  playerId: string
): TacticsOptions {
  return {
    availableTactics: state.availableTactics,
    isYourTurn: state.currentTacticSelector === playerId,
  };
}

/**
 * Placeholder for combat options.
 * TODO: Implement properly in Phase 4.
 */
function getCombatOptionsPlaceholder(state: GameState): {
  phase: string;
  canEndPhase: boolean;
} | null {
  if (!state.combat) return null;

  return {
    phase: state.combat.phase,
    canEndPhase: true, // Placeholder - needs proper logic
    // attacks, blocks, damageAssignments to be computed based on phase
  };
}
