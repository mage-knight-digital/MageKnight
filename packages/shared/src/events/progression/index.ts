/**
 * Progression Events
 *
 * Events related to player advancement: fame, reputation, levels, and skills.
 * These track the player's growth throughout the game.
 *
 * @module events/progression
 *
 * @remarks Progression System Overview
 * - **Fame**: Primary scoring metric, gained from combat and exploration
 * - **Reputation**: Affects unit costs, gained/lost from interactions
 * - **Levels**: Unlock skills and command slots, based on fame thresholds
 * - **Skills**: Permanent abilities gained at level up
 *
 * @example Progression Flow
 * ```
 * Combat Victory:
 *   ENEMY_DEFEATED
 *     |-> FAME_GAINED
 *           |-> If fame crosses threshold:
 *                 |-> LEVEL_UP
 *                 |-> LEVEL_UP_REWARDS_PENDING
 *                       |-> Player selects rewards
 *                       |-> SKILL_GAINED
 *                       |-> ADVANCED_ACTION_GAINED or COMMAND_SLOT_GAINED
 *
 * Site Interaction:
 *   SITE_CONQUERED
 *     |-> REPUTATION_CHANGED (may increase or decrease)
 * ```
 */

// Re-export all progression event modules
export * from "./fame.js";
export * from "./levels.js";
export * from "./skills.js";

// Import constants for the isProgressionEvent guard
import { FAME_GAINED, FAME_LOST, REPUTATION_CHANGED } from "./fame.js";
import {
  LEVEL_UP,
  LEVEL_UP_REWARDS_PENDING,
  ADVANCED_ACTION_GAINED,
  COMMAND_SLOT_GAINED,
} from "./levels.js";
import { SKILL_GAINED, SKILL_USED, MANA_OVERLOAD_TRIGGERED } from "./skills.js";

/**
 * Check if an event is any progression-related event.
 */
export function isProgressionEvent(event: { type: string }): boolean {
  return [
    FAME_GAINED,
    FAME_LOST,
    REPUTATION_CHANGED,
    LEVEL_UP,
    LEVEL_UP_REWARDS_PENDING,
    ADVANCED_ACTION_GAINED,
    COMMAND_SLOT_GAINED,
    SKILL_USED,
    SKILL_GAINED,
    MANA_OVERLOAD_TRIGGERED,
  ].includes(event.type as typeof FAME_GAINED);
}
