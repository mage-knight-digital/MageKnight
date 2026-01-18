/**
 * Fame and Reputation Events
 *
 * Events for fame gains/losses and reputation changes.
 *
 * @module events/progression/fame
 */

import type { ReputationChangeReason } from "../../valueConstants.js";

// ============================================================================
// FAME_GAINED
// ============================================================================

/**
 * Event type constant for gaining fame.
 * @see FameGainedEvent
 */
export const FAME_GAINED = "FAME_GAINED" as const;

/**
 * Emitted when a player gains fame points.
 *
 * Fame is the primary scoring metric and determines level ups.
 *
 * @remarks
 * - amount is the fame gained
 * - newTotal is the player's new fame total
 * - source indicates what granted the fame
 * - Common sources: defeating enemies, conquering sites, exploration
 *
 * @example
 * ```typescript
 * if (event.type === FAME_GAINED) {
 *   animateFameGain(event.amount);
 *   updateFameDisplay(event.newTotal);
 *   checkForLevelUp(event.playerId, event.newTotal);
 * }
 * ```
 */
export interface FameGainedEvent {
  readonly type: typeof FAME_GAINED;
  /** ID of the player who gained fame */
  readonly playerId: string;
  /** Amount of fame gained */
  readonly amount: number;
  /** New fame total */
  readonly newTotal: number;
  /** Source of the fame (e.g., "defeated_orc", "conquered_keep") */
  readonly source: string;
}

/**
 * Creates a FameGainedEvent.
 */
export function createFameGainedEvent(
  playerId: string,
  amount: number,
  newTotal: number,
  source: string
): FameGainedEvent {
  return {
    type: FAME_GAINED,
    playerId,
    amount,
    newTotal,
    source,
  };
}

/**
 * Type guard for FameGainedEvent.
 */
export function isFameGainedEvent(event: {
  type: string;
}): event is FameGainedEvent {
  return event.type === FAME_GAINED;
}

// ============================================================================
// FAME_LOST
// ============================================================================

/**
 * Event type constant for losing fame.
 * @see FameLostEvent
 */
export const FAME_LOST = "FAME_LOST" as const;

/**
 * Emitted when a player loses fame points.
 *
 * Fame loss is rare but can occur from certain negative events.
 *
 * @remarks
 * - amount is the fame lost (positive number)
 * - newTotal is the player's new fame total
 * - Cannot go below 0
 *
 * @example
 * ```typescript
 * if (event.type === FAME_LOST) {
 *   animateFameLoss(event.amount);
 *   updateFameDisplay(event.newTotal);
 * }
 * ```
 */
export interface FameLostEvent {
  readonly type: typeof FAME_LOST;
  /** ID of the player who lost fame */
  readonly playerId: string;
  /** Amount of fame lost */
  readonly amount: number;
  /** New fame total */
  readonly newTotal: number;
  /** Reason for fame loss */
  readonly source: string;
}

/**
 * Creates a FameLostEvent.
 */
export function createFameLostEvent(
  playerId: string,
  amount: number,
  newTotal: number,
  source: string
): FameLostEvent {
  return {
    type: FAME_LOST,
    playerId,
    amount,
    newTotal,
    source,
  };
}

// ============================================================================
// REPUTATION_CHANGED
// ============================================================================

/**
 * Event type constant for reputation change.
 * @see ReputationChangedEvent
 */
export const REPUTATION_CHANGED = "REPUTATION_CHANGED" as const;

/**
 * Emitted when a player's reputation changes.
 *
 * Reputation affects unit recruitment costs and some interactions.
 *
 * @remarks
 * - delta can be positive or negative
 * - newValue is the new reputation (typically -7 to +7)
 * - reason explains why reputation changed
 * - Low reputation = higher unit costs, some sites hostile
 * - High reputation = lower unit costs, better interactions
 *
 * @example
 * ```typescript
 * if (event.type === REPUTATION_CHANGED) {
 *   updateReputationDisplay(event.newValue);
 *   if (event.delta < 0) {
 *     showReputationPenalty(event.reason);
 *   }
 * }
 * ```
 */
export interface ReputationChangedEvent {
  readonly type: typeof REPUTATION_CHANGED;
  /** ID of the player whose reputation changed */
  readonly playerId: string;
  /** Change in reputation (can be negative) */
  readonly delta: number;
  /** New reputation value */
  readonly newValue: number;
  /** Reason for the change */
  readonly reason: ReputationChangeReason;
}

/**
 * Creates a ReputationChangedEvent.
 */
export function createReputationChangedEvent(
  playerId: string,
  delta: number,
  newValue: number,
  reason: ReputationChangeReason
): ReputationChangedEvent {
  return {
    type: REPUTATION_CHANGED,
    playerId,
    delta,
    newValue,
    reason,
  };
}

/**
 * Type guard for ReputationChangedEvent.
 */
export function isReputationChangedEvent(event: {
  type: string;
}): event is ReputationChangedEvent {
  return event.type === REPUTATION_CHANGED;
}
