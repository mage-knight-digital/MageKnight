/**
 * Tactic IDs - Aggregator
 *
 * This module re-exports all tactic IDs organized by time of day,
 * and provides the TacticId type derived from the exported arrays.
 */

// Re-export all tactic IDs from per-time-of-day modules
export * from "./day/index.js";
export * from "./night/index.js";

// Import arrays for type derivation
import { DAY_TACTIC_IDS } from "./day/index.js";
import { NIGHT_TACTIC_IDS } from "./night/index.js";

/**
 * All tactic IDs combined.
 * Used to derive the TacticId type.
 */
export const ALL_TACTIC_IDS = [...DAY_TACTIC_IDS, ...NIGHT_TACTIC_IDS] as const;

/**
 * Union type of all tactic IDs.
 * Auto-derived from the tactic ID arrays to prevent manual maintenance.
 */
export type TacticId = (typeof ALL_TACTIC_IDS)[number];
