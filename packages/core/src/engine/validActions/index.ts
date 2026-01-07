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
import { getValidMoveTargets } from "./movement.js";
import { getValidExploreOptions } from "./exploration.js";
import { getCombatOptions } from "./combat.js";
import { getPlayableCardsForCombat, getPlayableCardsForNormalTurn } from "./cards.js";
import { getManaOptions } from "./mana.js";
import { getUnitOptionsForCombat, getFullUnitOptions } from "./units.js";

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

// Re-export movement, exploration, combat, and units
export { getValidMoveTargets } from "./movement.js";
export { getValidExploreOptions } from "./exploration.js";
export { getCombatOptions } from "./combat.js";
export { getUnitOptions, getUnitOptionsForCombat, getActivatableUnits, getFullUnitOptions } from "./units.js";

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
      move: undefined,
      explore: undefined,
      playCard: undefined,
      combat: undefined,
      units: undefined,
      sites: undefined,
      mana: undefined,
      turn: undefined,
      tactics: undefined,
      enterCombat: undefined,
    };
  }

  const player = canActResult.player;

  // Handle tactics selection phase
  if (isTacticsPhase(state)) {
    return {
      canAct: true,
      reason: undefined,
      move: undefined,
      explore: undefined,
      playCard: undefined,
      combat: undefined,
      units: undefined,
      sites: undefined,
      mana: undefined,
      turn: undefined,
      tactics: getTacticsOptions(state, playerId),
      enterCombat: undefined,
    };
  }

  // Handle pending choice - must resolve before other actions
  if (hasPendingChoice(player)) {
    return {
      canAct: true,
      reason: undefined,
      move: undefined,
      explore: undefined,
      playCard: undefined,
      combat: undefined,
      units: undefined,
      sites: undefined,
      mana: undefined,
      // Only turn options (undo) available during pending choice
      turn: {
        canEndTurn: false,
        canAnnounceEndOfRound: false,
        canUndo: getTurnOptions(state, player).canUndo,
        canRest: false,
        restTypes: undefined,
      },
      tactics: undefined,
      enterCombat: undefined,
    };
  }

  // Handle combat
  if (isInCombat(state) && state.combat) {
    const combatOptions = getCombatOptions(state.combat);
    if (combatOptions) {
      const playCardOptions = getPlayableCardsForCombat(state, player, state.combat);
      const manaOptions = getManaOptions(state, player);
      const unitOptions = getUnitOptionsForCombat(state, player, state.combat);
      return {
        canAct: true,
        reason: undefined,
        move: undefined,
        explore: undefined,
        playCard: playCardOptions.cards.length > 0 ? playCardOptions : undefined,
        combat: combatOptions,
        units: unitOptions,
        sites: undefined,
        mana: manaOptions,
        turn: {
          canEndTurn: false,
          canAnnounceEndOfRound: false,
          canUndo: getTurnOptions(state, player).canUndo,
          canRest: false,
          restTypes: undefined,
        },
        tactics: undefined,
        enterCombat: undefined,
      };
    }
  }

  // Normal turn - compute all options
  const playCardOptions = getPlayableCardsForNormalTurn(state, player);
  const manaOptions = getManaOptions(state, player);

  return {
    canAct: true,
    reason: undefined,
    move: getValidMoveTargets(state, player),
    explore: getValidExploreOptions(state, player),
    playCard: playCardOptions.cards.length > 0 ? playCardOptions : undefined,
    combat: undefined,
    units: getFullUnitOptions(state, player),
    sites: undefined, // TODO Phase 6: getSiteOptions(state, player)
    mana: manaOptions,
    turn: getTurnOptions(state, player),
    tactics: undefined,
    enterCombat: undefined, // TODO: getEnterCombatOptions(state, player)
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

