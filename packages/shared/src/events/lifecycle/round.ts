/**
 * Round Lifecycle Events
 *
 * Events for round start and end.
 *
 * @module events/lifecycle/round
 */

import type { TimeOfDay } from "../../stateConstants.js";

// ============================================================================
// ROUND_STARTED
// ============================================================================

/**
 * Event type constant for round start.
 * @see RoundStartedEvent
 */
export const ROUND_STARTED = "ROUND_STARTED" as const;

/**
 * Emitted when a new round begins.
 *
 * Rounds alternate between day and night, affecting mana availability
 * and certain card effects.
 *
 * @remarks
 * - Precedes all TURN_STARTED events for this round
 * - isDay affects: gold mana (day only), black mana (night only)
 * - Round count determines game length for scoring
 *
 * @example Updating UI for day/night
 * ```typescript
 * if (event.type === ROUND_STARTED) {
 *   setTimeOfDay(event.isDay ? "day" : "night");
 *   updateManaSourceDisplay(event.isDay);
 * }
 * ```
 */
export interface RoundStartedEvent {
  readonly type: typeof ROUND_STARTED;
  /** Current round number (1-indexed) */
  readonly round: number;
  /** True if day phase, false if night phase */
  readonly isDay: boolean;
}

/**
 * Creates a RoundStartedEvent.
 *
 * @param round - Round number (1-indexed)
 * @param isDay - True for day phase, false for night
 * @returns A new RoundStartedEvent
 */
export function createRoundStartedEvent(
  round: number,
  isDay: boolean
): RoundStartedEvent {
  return {
    type: ROUND_STARTED,
    round,
    isDay,
  };
}

/**
 * Type guard for RoundStartedEvent.
 *
 * @param event - Any game event
 * @returns True if the event is a RoundStartedEvent
 */
export function isRoundStartedEvent(event: {
  type: string;
}): event is RoundStartedEvent {
  return event.type === ROUND_STARTED;
}

// ============================================================================
// ROUND_ENDED
// ============================================================================

/**
 * Event type constant for round end.
 * @see RoundEndedEvent
 */
export const ROUND_ENDED = "ROUND_ENDED" as const;

/**
 * Emitted when a round completes.
 *
 * All players have taken their turns. The game transitions to the next round
 * or ends if this was the final round.
 *
 * @remarks
 * - Follows the last TURN_ENDED of the round
 * - May precede TIME_OF_DAY_CHANGED and MANA_SOURCE_RESET
 * - Tactics selection begins for the next round
 *
 * @example
 * ```typescript
 * if (event.type === ROUND_ENDED) {
 *   showRoundSummary(event.round);
 *   prepareForTacticsPhase();
 * }
 * ```
 */
export interface RoundEndedEvent {
  readonly type: typeof ROUND_ENDED;
  /** The round number that just ended */
  readonly round: number;
}

/**
 * Creates a RoundEndedEvent.
 *
 * @param round - The round number that ended
 * @returns A new RoundEndedEvent
 */
export function createRoundEndedEvent(round: number): RoundEndedEvent {
  return {
    type: ROUND_ENDED,
    round,
  };
}

/**
 * Type guard for RoundEndedEvent.
 *
 * @param event - Any game event
 * @returns True if the event is a RoundEndedEvent
 */
export function isRoundEndedEvent(event: {
  type: string;
}): event is RoundEndedEvent {
  return event.type === ROUND_ENDED;
}

// ============================================================================
// NEW_ROUND_STARTED
// ============================================================================

/**
 * Event type constant for new round initialization.
 * @see NewRoundStartedEvent
 */
export const NEW_ROUND_STARTED = "NEW_ROUND_STARTED" as const;

/**
 * Emitted when a new round begins after the previous round's cleanup.
 *
 * Similar to ROUND_STARTED but includes TimeOfDay type information.
 *
 * @remarks
 * - Follows ROUND_ENDED from previous round
 * - Includes full TimeOfDay enum value, not just boolean
 *
 * @example
 * ```typescript
 * if (event.type === NEW_ROUND_STARTED) {
 *   updateRoundCounter(event.roundNumber);
 *   setTimeOfDay(event.timeOfDay);
 * }
 * ```
 */
export interface NewRoundStartedEvent {
  readonly type: typeof NEW_ROUND_STARTED;
  /** The new round number */
  readonly roundNumber: number;
  /** Time of day for the new round */
  readonly timeOfDay: TimeOfDay;
}

/**
 * Creates a NewRoundStartedEvent.
 *
 * @param roundNumber - The new round number
 * @param timeOfDay - Time of day value
 * @returns A new NewRoundStartedEvent
 */
export function createNewRoundStartedEvent(
  roundNumber: number,
  timeOfDay: TimeOfDay
): NewRoundStartedEvent {
  return {
    type: NEW_ROUND_STARTED,
    roundNumber,
    timeOfDay,
  };
}
