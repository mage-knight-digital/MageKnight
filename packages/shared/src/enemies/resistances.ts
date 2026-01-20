/**
 * Enemy Resistance Constants
 *
 * Pre-defined resistance configurations for common enemy types.
 * These constants reduce boilerplate when defining enemies with
 * standard resistance patterns.
 *
 * @module enemies/resistances
 */

import type { EnemyResistances } from "./types.js";

// =============================================================================
// RESISTANCE CONSTANTS
// =============================================================================

/**
 * No elemental resistances - vulnerable to all attack types
 */
export const NO_RESISTANCES: EnemyResistances = {
  physical: false,
  fire: false,
  ice: false,
};

/**
 * Physical resistance only - common for golems and armored enemies
 */
export const PHYSICAL_RESISTANCE: EnemyResistances = {
  physical: true,
  fire: false,
  ice: false,
};

/**
 * Fire resistance only - common for fire-based enemies
 */
export const FIRE_RESISTANCE: EnemyResistances = {
  physical: false,
  fire: true,
  ice: false,
};

/**
 * Ice resistance only - common for ice-based enemies
 */
export const ICE_RESISTANCE: EnemyResistances = {
  physical: false,
  fire: false,
  ice: true,
};

/**
 * Fire and ice resistance - common for powerful magical enemies
 */
export const FIRE_ICE_RESISTANCE: EnemyResistances = {
  physical: false,
  fire: true,
  ice: true,
};

/**
 * Physical and fire resistance - common for fire dragons
 */
export const PHYSICAL_FIRE_RESISTANCE: EnemyResistances = {
  physical: true,
  fire: true,
  ice: false,
};

/**
 * Physical and ice resistance - common for ice dragons
 */
export const PHYSICAL_ICE_RESISTANCE: EnemyResistances = {
  physical: true,
  fire: false,
  ice: true,
};

// =============================================================================
// RESISTANCE DESCRIPTIONS (Rulebook text)
// =============================================================================

/**
 * Resistance type for description lookup
 */
export type ResistanceType = "physical" | "fire" | "ice";

/**
 * Resistance description for UI display
 */
export interface ResistanceDescription {
  readonly name: string;
  /** Icon for visual display */
  readonly icon: string;
  /** Full rulebook description */
  readonly fullDesc: string;
  /** What counters this resistance */
  readonly counter: string;
}

/**
 * Descriptions for resistance types.
 * Source: Mage Knight Ultimate Edition Rulebook
 */
export const RESISTANCE_DESCRIPTIONS: Record<ResistanceType, ResistanceDescription> = {
  physical: {
    name: "Physical Resistance",
    icon: "🛡️",
    fullDesc: "All physical Attacks (including cards played sideways) are inefficient – their Attack value is halved.",
    counter: "Use Fire, Ice, or ColdFire attacks for full damage.",
  },
  fire: {
    name: "Fire Resistance",
    icon: "🔥",
    fullDesc: "All Fire Attacks are inefficient – their Attack value is halved.",
    counter: "Use Physical, Ice, or ColdFire attacks for full damage.",
  },
  ice: {
    name: "Ice Resistance",
    icon: "❄️",
    fullDesc: "All Ice Attacks are inefficient – their Attack value is halved.",
    counter: "Use Physical, Fire, or ColdFire attacks for full damage.",
  },
};
