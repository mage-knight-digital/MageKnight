/**
 * Time of Day Events
 *
 * Events for time of day changes and mana source reset.
 *
 * @module events/lifecycle/time
 */

import type { TimeOfDay } from "../../stateConstants.js";

// ============================================================================
// TIME_OF_DAY_CHANGED
// ============================================================================

/**
 * Event type constant for time of day changes.
 * @see TimeOfDayChangedEvent
 */
export const TIME_OF_DAY_CHANGED = "TIME_OF_DAY_CHANGED" as const;

/**
 * Emitted when time of day transitions between day and night.
 *
 * This affects mana availability and certain card effects.
 *
 * @remarks
 * - Typically occurs between rounds
 * - Day: Gold mana available, black mana depleted
 * - Night: Black mana available, gold mana depleted
 *
 * @example
 * ```typescript
 * if (event.type === TIME_OF_DAY_CHANGED) {
 *   playTransitionAnimation(event.from, event.to);
 *   updateManaSourceVisibility(event.to);
 * }
 * ```
 */
export interface TimeOfDayChangedEvent {
  readonly type: typeof TIME_OF_DAY_CHANGED;
  /** Previous time of day */
  readonly from: TimeOfDay;
  /** New time of day */
  readonly to: TimeOfDay;
}

/**
 * Creates a TimeOfDayChangedEvent.
 *
 * @param from - Previous time of day
 * @param to - New time of day
 * @returns A new TimeOfDayChangedEvent
 */
export function createTimeOfDayChangedEvent(
  from: TimeOfDay,
  to: TimeOfDay
): TimeOfDayChangedEvent {
  return {
    type: TIME_OF_DAY_CHANGED,
    from,
    to,
  };
}

/**
 * Type guard for TimeOfDayChangedEvent.
 *
 * @param event - Any game event
 * @returns True if the event is a TimeOfDayChangedEvent
 */
export function isTimeOfDayChangedEvent(event: {
  type: string;
}): event is TimeOfDayChangedEvent {
  return event.type === TIME_OF_DAY_CHANGED;
}

// ============================================================================
// MANA_SOURCE_RESET
// ============================================================================

/**
 * Event type constant for mana source reset.
 * @see ManaSourceResetEvent
 */
export const MANA_SOURCE_RESET = "MANA_SOURCE_RESET" as const;

/**
 * Emitted when the mana source (shared dice pool) is reset.
 *
 * This typically happens at the start of each round.
 *
 * @remarks
 * - Dice are re-rolled and made available
 * - diceCount = number of players + 2
 * - Related: Follows NEW_ROUND_STARTED or ROUND_STARTED
 *
 * @example
 * ```typescript
 * if (event.type === MANA_SOURCE_RESET) {
 *   resetManaPoolDisplay(event.diceCount);
 * }
 * ```
 */
export interface ManaSourceResetEvent {
  readonly type: typeof MANA_SOURCE_RESET;
  /** Number of dice in the mana source */
  readonly diceCount: number;
}

/**
 * Creates a ManaSourceResetEvent.
 *
 * @param diceCount - Number of dice available
 * @returns A new ManaSourceResetEvent
 */
export function createManaSourceResetEvent(
  diceCount: number
): ManaSourceResetEvent {
  return {
    type: MANA_SOURCE_RESET,
    diceCount,
  };
}
