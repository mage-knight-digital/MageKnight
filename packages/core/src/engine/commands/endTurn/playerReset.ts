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
    hasRecruitedUnitThisTurn: false,
    unitsRecruitedThisInteraction: [], // Reset interaction tracking at turn end
    isResting: false, // Reset resting state at turn start
    // Mana resets
    pureMana: [],
    usedManaFromSource: false,
    usedDieIds: [],
    manaDrawDieIds: [],
    manaUsedThisTurn: [],
    spellColorsCastThisTurn: [],
    spellsCastByColorThisTurn: {},
    // Card flow updates
    playArea: cardFlow.playArea,
    hand: cardFlow.hand,
    deck: cardFlow.deck,
    discard: cardFlow.discard,
    // Time Bending set-aside cards
    timeBendingSetAsideCards: cardFlow.timeBendingSetAsideCards ?? player.timeBendingSetAsideCards,
    // Combat reset
    combatAccumulator: createEmptyCombatAccumulator(),
    enemiesDefeatedThisTurn: 0, // Reset for Sword of Justice fame tracking
    pendingAttackDefeatFame: [], // Reset attack-based fame trackers
    // Tactic state reset (preserve round-persistent state like storedManaDie)
    tacticState: {
      ...player.tacticState,
      manaStealUsedThisTurn: false,
      manaSearchUsedThisTurn: false,
    },
    // Spell effect resets
    woundImmunityActive: false,
    // Cure spell tracking resets
    woundsHealedFromHandThisTurn: 0,
    unitsHealedThisTurn: [],
    // Banner of Protection resets
    woundsReceivedThisTurn: { hand: 0, discard: 0 },
    bannerOfProtectionActive: false,
    pendingBannerProtectionChoice: false,
    // Crystal Mastery resets
    spentCrystalsThisTurn: { red: 0, blue: 0, green: 0, white: 0 },
    crystalMasteryPoweredActive: false,
    // Meditation spell resets
    pendingMeditation: undefined,
    meditationHandLimitBonus: 0,
    // Skill cooldown reset for Time Bending: refresh once-per-turn skills
    // (usedThisTurn is cleared when isTimeBentTurn is being set up in turnAdvancement)
  };
}
