/**
 * Combat Resolution Events
 *
 * Events for damage assignment, combat end, and special combat outcomes.
 *
 * @module events/combat/resolution
 */

import type { HexCoord } from "../../hex.js";
import {
  COMBAT_EXIT_REASON_FLED,
  COMBAT_EXIT_REASON_UNDO,
  COMBAT_EXIT_REASON_WITHDRAW,
} from "../../valueConstants.js";

// ============================================================================
// DAMAGE_ASSIGNED
// ============================================================================

/**
 * Event type constant for damage assignment.
 * @see DamageAssignedEvent
 */
export const DAMAGE_ASSIGNED = "DAMAGE_ASSIGNED" as const;

/**
 * Emitted when enemy damage is assigned to the player.
 *
 * Unblocked enemies deal damage during ASSIGN_DAMAGE phase.
 * For multi-attack enemies, each attack's damage is assigned separately.
 *
 * @remarks
 * - damage is the raw enemy attack value
 * - woundsTaken is how many wound cards are added
 * - Wounds can be assigned to units instead of hero
 * - Multi-attack enemies: each unblocked attack generates a separate event
 *
 * @example
 * ```typescript
 * if (event.type === DAMAGE_ASSIGNED) {
 *   showDamageAnimation(event.damage);
 *   addWoundsToHand(event.woundsTaken);
 * }
 * ```
 */
export interface DamageAssignedEvent {
  readonly type: typeof DAMAGE_ASSIGNED;
  /** Instance ID of the attacking enemy */
  readonly enemyInstanceId: string;
  /**
   * For multi-attack enemies, which attack dealt the damage (0-indexed).
   * Undefined for single-attack enemies (backwards compatible).
   */
  readonly attackIndex?: number;
  /** Raw damage dealt */
  readonly damage: number;
  /** Number of wound cards taken */
  readonly woundsTaken: number;
}

/**
 * Creates a DamageAssignedEvent.
 */
export function createDamageAssignedEvent(
  enemyInstanceId: string,
  damage: number,
  woundsTaken: number
): DamageAssignedEvent {
  return {
    type: DAMAGE_ASSIGNED,
    enemyInstanceId,
    damage,
    woundsTaken,
  };
}

// ============================================================================
// COMBAT_ENDED
// ============================================================================

/**
 * Event type constant for combat end.
 * @see CombatEndedEvent
 */
export const COMBAT_ENDED = "COMBAT_ENDED" as const;

/**
 * Emitted when combat concludes normally.
 *
 * Contains summary of combat results.
 *
 * @remarks
 * - victory is true if all enemies defeated
 * - Player may still have taken damage/wounds
 * - Follows last ENEMY_DEFEATED or failed attack
 *
 * @example
 * ```typescript
 * if (event.type === COMBAT_ENDED) {
 *   showCombatSummary(event);
 *   if (event.victory) {
 *     playVictoryAnimation();
 *   } else {
 *     showDefeatMessage();
 *   }
 *   returnToNormalPlay();
 * }
 * ```
 */
export interface CombatEndedEvent {
  readonly type: typeof COMBAT_ENDED;
  /** True if player won (all enemies defeated) */
  readonly victory: boolean;
  /** Total fame earned in this combat */
  readonly totalFameGained: number;
  /** Number of enemies defeated */
  readonly enemiesDefeated: number;
  /** Number of enemies that survived */
  readonly enemiesSurvived: number;
}

/**
 * Creates a CombatEndedEvent.
 */
export function createCombatEndedEvent(
  victory: boolean,
  totalFameGained: number,
  enemiesDefeated: number,
  enemiesSurvived: number
): CombatEndedEvent {
  return {
    type: COMBAT_ENDED,
    victory,
    totalFameGained,
    enemiesDefeated,
    enemiesSurvived,
  };
}

/**
 * Type guard for CombatEndedEvent.
 */
export function isCombatEndedEvent(event: {
  type: string;
}): event is CombatEndedEvent {
  return event.type === COMBAT_ENDED;
}

// ============================================================================
// COMBAT_EXITED
// ============================================================================

/**
 * Event type constant for combat exit.
 * @see CombatExitedEvent
 */
export const COMBAT_EXITED = "COMBAT_EXITED" as const;

/**
 * Emitted when combat ends without normal resolution.
 *
 * This can happen via undo, withdrawal, or fleeing.
 *
 * @remarks
 * - UNDO: Combat was undone (before irreversible action)
 * - WITHDRAW: Player chose to retreat (reputation penalty)
 * - FLED: Player forced to flee (e.g., knocked out)
 *
 * @example
 * ```typescript
 * if (event.type === COMBAT_EXITED) {
 *   if (event.reason === COMBAT_EXIT_REASON_WITHDRAW) {
 *     showWithdrawalPenalty();
 *   }
 *   cleanupCombatUI();
 * }
 * ```
 */
export interface CombatExitedEvent {
  readonly type: typeof COMBAT_EXITED;
  /** ID of the player who exited combat */
  readonly playerId: string;
  /** Reason for exiting */
  readonly reason:
    | typeof COMBAT_EXIT_REASON_UNDO
    | typeof COMBAT_EXIT_REASON_WITHDRAW
    | typeof COMBAT_EXIT_REASON_FLED;
}

/**
 * Creates a CombatExitedEvent.
 */
export function createCombatExitedEvent(
  playerId: string,
  reason: CombatExitedEvent["reason"]
): CombatExitedEvent {
  return {
    type: COMBAT_EXITED,
    playerId,
    reason,
  };
}

// ============================================================================
// PLAYER_KNOCKED_OUT
// ============================================================================

/**
 * Event type constant for player knockout.
 * @see PlayerKnockedOutEvent
 */
export const PLAYER_KNOCKED_OUT = "PLAYER_KNOCKED_OUT" as const;

/**
 * Emitted when a player is knocked out in combat.
 *
 * The player took too many wounds and cannot continue.
 *
 * @remarks
 * - Occurs when wounds fill entire hand
 * - Player's turn ends immediately
 * - Player must retreat to safe space
 * - Significant game penalty
 *
 * @example
 * ```typescript
 * if (event.type === PLAYER_KNOCKED_OUT) {
 *   showKnockoutAnimation(event.playerId);
 *   disableAllActions(event.playerId);
 * }
 * ```
 */
export interface PlayerKnockedOutEvent {
  readonly type: typeof PLAYER_KNOCKED_OUT;
  /** ID of the knocked out player */
  readonly playerId: string;
  /** Total wounds taken this combat */
  readonly woundsThisCombat: number;
}

/**
 * Creates a PlayerKnockedOutEvent.
 */
export function createPlayerKnockedOutEvent(
  playerId: string,
  woundsThisCombat: number
): PlayerKnockedOutEvent {
  return {
    type: PLAYER_KNOCKED_OUT,
    playerId,
    woundsThisCombat,
  };
}

// ============================================================================
// PARALYZE_HAND_DISCARDED
// ============================================================================

/**
 * Event type constant for paralyze discard.
 * @see ParalyzeHandDiscardedEvent
 */
export const PARALYZE_HAND_DISCARDED = "PARALYZE_HAND_DISCARDED" as const;

/**
 * Emitted when a player's hand is discarded due to paralysis.
 *
 * Some enemies have paralyze attacks that force hand discard.
 *
 * @remarks
 * - Paralyze is a special attack type
 * - All cards in hand (except wounds) are discarded
 * - Devastating effect that limits options
 *
 * @example
 * ```typescript
 * if (event.type === PARALYZE_HAND_DISCARDED) {
 *   animateHandDiscard(event.playerId);
 *   showParalyzeEffect();
 * }
 * ```
 */
export interface ParalyzeHandDiscardedEvent {
  readonly type: typeof PARALYZE_HAND_DISCARDED;
  /** ID of the paralyzed player */
  readonly playerId: string;
  /** Number of cards discarded */
  readonly cardsDiscarded: number;
}

/**
 * Creates a ParalyzeHandDiscardedEvent.
 */
export function createParalyzeHandDiscardedEvent(
  playerId: string,
  cardsDiscarded: number
): ParalyzeHandDiscardedEvent {
  return {
    type: PARALYZE_HAND_DISCARDED,
    playerId,
    cardsDiscarded,
  };
}

// ============================================================================
// PLAYER_WITHDREW
// ============================================================================

/**
 * Event type constant for player withdrawal.
 * @see PlayerWithdrewEvent
 */
export const PLAYER_WITHDREW = "PLAYER_WITHDREW" as const;

/**
 * Emitted when a player withdraws from combat.
 *
 * The player retreats to an adjacent safe hex.
 *
 * @remarks
 * - Incurs reputation penalty
 * - Enemies remain at the location
 * - Player moves to adjacent safe hex
 * - Triggers: WITHDRAW_ACTION during combat
 *
 * @example
 * ```typescript
 * if (event.type === PLAYER_WITHDREW) {
 *   animateRetreat(event.playerId, event.from, event.to);
 *   showReputationPenalty();
 * }
 * ```
 */
export interface PlayerWithdrewEvent {
  readonly type: typeof PLAYER_WITHDREW;
  /** ID of the withdrawing player */
  readonly playerId: string;
  /** Hex the player withdrew from */
  readonly from: HexCoord;
  /** Hex the player retreated to */
  readonly to: HexCoord;
}

/**
 * Creates a PlayerWithdrewEvent.
 */
export function createPlayerWithdrewEvent(
  playerId: string,
  from: HexCoord,
  to: HexCoord
): PlayerWithdrewEvent {
  return {
    type: PLAYER_WITHDREW,
    playerId,
    from,
    to,
  };
}
