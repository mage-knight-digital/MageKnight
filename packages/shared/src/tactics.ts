/**
 * Tactics cards - used during tactics selection phase to determine turn order
 *
 * Each round, players select a tactic card. The number on the card determines
 * turn order (lower numbers go first). Some tactics have additional effects.
 */

import type { TimeOfDay } from "./stateConstants.js";

// === Tactic IDs ===
// Day tactics (1-6)
export const TACTIC_EARLY_BIRD = "early_bird" as const;
export const TACTIC_RETHINK = "rethink" as const;
export const TACTIC_MANA_STEAL = "mana_steal" as const;
export const TACTIC_PLANNING = "planning" as const;
export const TACTIC_THE_RIGHT_MOMENT = "the_right_moment" as const;
export const TACTIC_GREAT_START = "great_start" as const;

// Night tactics (1-6)
export const TACTIC_FROM_THE_DUSK = "from_the_dusk" as const;
export const TACTIC_LONG_NIGHT = "long_night" as const;
export const TACTIC_MANA_SEARCH = "mana_search" as const;
export const TACTIC_MIDNIGHT_MEDITATION = "midnight_meditation" as const;
export const TACTIC_PREPARATION = "preparation" as const;
export const TACTIC_SPARING_POWER = "sparing_power" as const;

export type TacticId =
  // Day tactics (1-6)
  | typeof TACTIC_EARLY_BIRD
  | typeof TACTIC_RETHINK
  | typeof TACTIC_MANA_STEAL
  | typeof TACTIC_PLANNING
  | typeof TACTIC_GREAT_START
  | typeof TACTIC_THE_RIGHT_MOMENT
  // Night tactics (1-6)
  | typeof TACTIC_FROM_THE_DUSK
  | typeof TACTIC_LONG_NIGHT
  | typeof TACTIC_MANA_SEARCH
  | typeof TACTIC_MIDNIGHT_MEDITATION
  | typeof TACTIC_PREPARATION
  | typeof TACTIC_SPARING_POWER;

// All tactic IDs for iteration (in turn order 1-6)
export const ALL_DAY_TACTICS: readonly TacticId[] = [
  TACTIC_EARLY_BIRD,
  TACTIC_RETHINK,
  TACTIC_MANA_STEAL,
  TACTIC_PLANNING,
  TACTIC_GREAT_START,
  TACTIC_THE_RIGHT_MOMENT,
] as const;

export const ALL_NIGHT_TACTICS: readonly TacticId[] = [
  TACTIC_FROM_THE_DUSK,
  TACTIC_LONG_NIGHT,
  TACTIC_MANA_SEARCH,
  TACTIC_MIDNIGHT_MEDITATION,
  TACTIC_PREPARATION,
  TACTIC_SPARING_POWER,
] as const;

export const ALL_TACTICS: readonly TacticId[] = [
  ...ALL_DAY_TACTICS,
  ...ALL_NIGHT_TACTICS,
] as const;

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
export function getTacticsForTimeOfDay(timeOfDay: TimeOfDay): readonly TacticId[] {
  return timeOfDay === "day" ? ALL_DAY_TACTICS : ALL_NIGHT_TACTICS;
}
