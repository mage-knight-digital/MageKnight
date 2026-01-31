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
    isResting: false, // Reset resting state at turn start
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
    // Skill cooldown resets
    // - usedThisTurn: cleared so once-per-turn skills can be used next turn
    // - activeUntilNextTurn: only clear skills NOT used this turn (lockout expired)
    //   Skills used THIS turn stay locked until end of NEXT turn
    skillCooldowns: {
      ...player.skillCooldowns,
      usedThisTurn: [],
      // Only clear skills from activeUntilNextTurn that were NOT used this turn
      // Skills used this turn have their lockout persist until next turn ends
      activeUntilNextTurn: player.skillCooldowns.activeUntilNextTurn.filter(
        (skillId) => player.skillCooldowns.usedThisTurn.includes(skillId)
      ),
    },
  };
}
