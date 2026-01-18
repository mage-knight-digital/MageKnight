/**
 * Tactics Events
 *
 * Events related to the tactics selection phase at the start of each round,
 * as well as tactic activation effects during gameplay.
 *
 * @module events/tactics
 *
 * @example Tactics Phase Flow
 * ```
 * ROUND_STARTED
 *   |-> (each player selects a tactic)
 *         |-> TACTIC_SELECTED (player 0)
 *         |-> TACTIC_SELECTED (player 1)
 *         |-> DUMMY_TACTIC_SELECTED (solo game only)
 *   |-> TACTICS_PHASE_ENDED (final turn order determined)
 *   |-> TURN_STARTED (first player from turn order)
 *         |-> TACTIC_ACTIVATED (if tactic has start-of-turn effect)
 *         |-> TACTIC_DECISION_RESOLVED (if tactic required choice)
 * ```
 */

// Re-export all tactics event modules
export * from "./selection.js";
export * from "./activation.js";
export * from "./rest.js";

// Import constants for the isTacticsEvent guard
import {
  TACTIC_SELECTED,
  DUMMY_TACTIC_SELECTED,
  TACTICS_PHASE_ENDED,
} from "./selection.js";
import {
  TACTIC_ACTIVATED,
  TACTIC_DECISION_RESOLVED,
  SOURCE_DICE_REROLLED,
} from "./activation.js";
import { DECKS_RESHUFFLED, PLAYER_RESTED, REST_UNDONE } from "./rest.js";

/**
 * Check if an event is any tactics-related event.
 */
export function isTacticsEvent(event: { type: string }): boolean {
  return [
    TACTIC_SELECTED,
    DUMMY_TACTIC_SELECTED,
    TACTICS_PHASE_ENDED,
    TACTIC_ACTIVATED,
    TACTIC_DECISION_RESOLVED,
    SOURCE_DICE_REROLLED,
    DECKS_RESHUFFLED,
    PLAYER_RESTED,
    REST_UNDONE,
  ].includes(event.type as typeof TACTIC_SELECTED);
}
