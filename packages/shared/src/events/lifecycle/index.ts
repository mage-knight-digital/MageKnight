/**
 * Game Lifecycle Events
 *
 * Events that mark major game state transitions: game start/end, rounds, turns,
 * and time of day changes. These events structure the game flow and determine
 * when players can take actions.
 *
 * @module events/lifecycle
 *
 * @example Event Flow
 * ```
 * GAME_STARTED
 *   |-> ROUND_STARTED (round 1, isDay: true)
 *         |-> TURN_STARTED (player 0)
 *         |     |-> ... player actions ...
 *         |     |-> TURN_ENDED
 *         |-> TURN_STARTED (player 1)
 *         |     |-> ... player actions ...
 *         |     |-> END_OF_ROUND_ANNOUNCED (optional)
 *         |     |-> TURN_ENDED
 *         |-> ROUND_ENDED
 *               |-> TIME_OF_DAY_CHANGED (if applicable)
 *               |-> MANA_SOURCE_RESET
 *   |-> ROUND_STARTED (round 2, isDay: false)
 *         |-> ... more turns ...
 *   |-> SCENARIO_END_TRIGGERED
 *   |-> GAME_ENDED
 * ```
 */

// Re-export all lifecycle event modules
export * from "./game.js";
export * from "./round.js";
export * from "./turn.js";
export * from "./time.js";

// Import constants for the isLifecycleEvent guard
import { GAME_STARTED, GAME_ENDED, SCENARIO_END_TRIGGERED } from "./game.js";
import { ROUND_STARTED, ROUND_ENDED, NEW_ROUND_STARTED } from "./round.js";
import { TURN_STARTED, TURN_ENDED, END_OF_ROUND_ANNOUNCED } from "./turn.js";
import { TIME_OF_DAY_CHANGED, MANA_SOURCE_RESET } from "./time.js";

/**
 * Check if an event is any lifecycle event.
 *
 * @param event - Any game event
 * @returns True if the event is a lifecycle event
 *
 * @example
 * ```typescript
 * if (isLifecycleEvent(event)) {
 *   updateGamePhaseIndicator(event);
 * }
 * ```
 */
export function isLifecycleEvent(event: { type: string }): boolean {
  return [
    GAME_STARTED,
    ROUND_STARTED,
    TURN_STARTED,
    TURN_ENDED,
    ROUND_ENDED,
    GAME_ENDED,
    SCENARIO_END_TRIGGERED,
    END_OF_ROUND_ANNOUNCED,
    NEW_ROUND_STARTED,
    TIME_OF_DAY_CHANGED,
    MANA_SOURCE_RESET,
  ].includes(event.type as typeof GAME_STARTED);
}
