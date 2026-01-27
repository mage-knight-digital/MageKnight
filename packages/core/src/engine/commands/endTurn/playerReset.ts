/**
 * Player Reset for End Turn
 *
 * Resets player's turn state (move points, mana, combat accumulator, etc.)
 *
 * @module commands/endTurn/playerReset
 */

import type { Player } from "../../../types/player.js";
import { createEmptyCombatAccumulator } from "../../../types/player.js";
import type { CardFlowResult } from "./types.js";

/**
 * Create a reset player state for end of turn.
 * Clears turn-specific state and applies card flow changes.
 */
export function createResetPlayer(
  player: Player,
  cardFlow: CardFlowResult
): Player {
  return {
    ...player,
    // Movement and action resets
    movePoints: 0,
    influencePoints: 0,
    hasMovedThisTurn: false,
    hasTakenActionThisTurn: false,
    hasCombattedThisTurn: false,
playedCardFromHandThisTurn: false,
    hasPlunderedThisTurn: false,
    // Mana resets
    pureMana: [],
    usedManaFromSource: false,
    usedDieIds: [],
    manaDrawDieIds: [],
    manaUsedThisTurn: [],
    // Card flow updates
    playArea: cardFlow.playArea,
    hand: cardFlow.hand,
    deck: cardFlow.deck,
    discard: cardFlow.discard,
    // Combat reset
    combatAccumulator: createEmptyCombatAccumulator(),
    // Tactic state reset (preserve round-persistent state like storedManaDie)
    tacticState: {
      ...player.tacticState,
      manaStealUsedThisTurn: false,
      manaSearchUsedThisTurn: false,
    },
  };
}
