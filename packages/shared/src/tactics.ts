/**
 * Tactics cards - used during tactics selection phase to determine turn order
 *
 * Each round, players select a tactic card. The number on the card determines
 * turn order (lower numbers go first). Some tactics have additional effects.
 */

import type { TimeOfDay } from "./stateConstants.js";

// === Tactic IDs ===
// Re-export all tactic IDs and type from the modular structure
export * from "./tacticIds/index.js";
export type { TacticId } from "./tacticIds/index.js";

// Import arrays for local use in helper functions
import {
  DAY_TACTIC_IDS,
  NIGHT_TACTIC_IDS,
  ALL_TACTIC_IDS,
  type TacticId,
} from "./tacticIds/index.js";

// Re-export arrays with backwards-compatible names
export const ALL_DAY_TACTICS: readonly TacticId[] = DAY_TACTIC_IDS;
export const ALL_NIGHT_TACTICS: readonly TacticId[] = NIGHT_TACTIC_IDS;
export const ALL_TACTICS: readonly TacticId[] = ALL_TACTIC_IDS;

// === Effect types ===
// These describe WHEN/HOW the tactic's effect triggers
export const TACTIC_EFFECT_TYPE_NONE = "none" as const;
export const TACTIC_EFFECT_TYPE_ON_PICK = "on_pick" as const;
export const TACTIC_EFFECT_TYPE_ONGOING = "ongoing" as const;
export const TACTIC_EFFECT_TYPE_ACTIVATED = "activated" as const;

export type TacticEffectType =
  | typeof TACTIC_EFFECT_TYPE_NONE
  | typeof TACTIC_EFFECT_TYPE_ON_PICK
  | typeof TACTIC_EFFECT_TYPE_ONGOING
  | typeof TACTIC_EFFECT_TYPE_ACTIVATED;

// === Tactic Card interface ===
export interface TacticCard {
  readonly id: TacticId;
  readonly name: string;
  readonly turnOrder: number; // 1-6, lower goes first
  readonly timeOfDay: TimeOfDay; // Which half of round this tactic is for
  readonly effectType: TacticEffectType;
  readonly effectDescription: string;
  readonly implemented: boolean; // Whether the effect is actually implemented
}

// === Helper functions ===

/**
 * Get tactics available for the given time of day
 */
export function getTacticsForTimeOfDay(
  timeOfDay: TimeOfDay
): readonly TacticId[] {
  return timeOfDay === "day" ? DAY_TACTIC_IDS : NIGHT_TACTIC_IDS;
}
