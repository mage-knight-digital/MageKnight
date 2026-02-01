/**
 * Advanced Action Card IDs - Aggregator
 *
 * This module re-exports all advanced action card IDs organized by color,
 * and provides the AdvancedActionCardId type derived from the exported arrays.
 */

// Re-export all card IDs from per-color modules
export * from "./bolts/index.js";
export * from "./red/index.js";
export * from "./blue/index.js";
export * from "./white/index.js";
export * from "./green/index.js";
export * from "./dual/index.js";

// Import arrays for type derivation
import { BOLT_IDS } from "./bolts/index.js";
import { RED_AA_IDS } from "./red/index.js";
import { BLUE_AA_IDS } from "./blue/index.js";
import { WHITE_AA_IDS } from "./white/index.js";
import { GREEN_AA_IDS } from "./green/index.js";
import { DUAL_AA_IDS } from "./dual/index.js";

/**
 * All advanced action card IDs combined.
 * Used to derive the AdvancedActionCardId type.
 */
export const ALL_ADVANCED_ACTION_IDS = [
  ...BOLT_IDS,
  ...RED_AA_IDS,
  ...BLUE_AA_IDS,
  ...WHITE_AA_IDS,
  ...GREEN_AA_IDS,
  ...DUAL_AA_IDS,
] as const;

/**
 * Union type of all advanced action card IDs.
 * Auto-derived from the card ID arrays to prevent manual maintenance.
 */
export type AdvancedActionCardId = (typeof ALL_ADVANCED_ACTION_IDS)[number];
