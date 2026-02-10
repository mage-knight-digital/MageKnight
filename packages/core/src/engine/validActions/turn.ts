/**
 * Turn structure action options.
 *
 * Determines what turn-related actions are available:
 * - End turn
 * - Announce end of round
 * - Rest (standard / slow recovery)
 * - Undo
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { TurnOptions } from "@mage-knight/shared";
import { canUndo } from "../commands/stack.js";
import { mustAnnounceEndOfRound } from "./helpers.js";
import {
  getAvailableRestTypes,
  canDeclareRest,
  canCompleteRest,
  canEndTurn,
  getRestDiscardableCards,
} from "../rules/turnStructure.js";

/**
 * Get available turn options for a player.
 */
export function getTurnOptions(state: GameState, player: Player): TurnOptions {
  const mustAnnounce = mustAnnounceEndOfRound(state, player);
  const canDeclareRestOption = canDeclareRest(state, player);
  const canCompleteRestOption = canCompleteRest(player) && !mustAnnounce;

  return {
    canEndTurn: canEndTurn(state, player),
    canAnnounceEndOfRound: checkCanAnnounceEndOfRound(state, player),
    canUndo: canUndo(state.commandStack),
    canRest: canDeclareRestOption, // Legacy field - maps to canDeclareRest
    restTypes: getAvailableRestTypes(player),
    canDeclareRest: canDeclareRestOption,
    canCompleteRest: canCompleteRestOption,
    isResting: player.isResting,
    restDiscard: canCompleteRestOption ? getRestDiscardableCards(player) : undefined,
  };
}


/**
 * Check if player can announce end of round.
 * Requirements:
 * - Deck must be empty (or deck+hand empty for auto-announce)
 * - Round end not already announced
 */
function checkCanAnnounceEndOfRound(state: GameState, player: Player): boolean {
  // Already announced
  if (state.endOfRoundAnnouncedBy !== null) {
    return false;
  }

  // Must have empty deck to announce
  if (player.deck.length > 0) {
    return false;
  }

  return true;
}

