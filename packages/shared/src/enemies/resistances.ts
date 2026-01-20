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
    fullDesc: "All physical Attacks (including cards played sideways) are inefficient (halved). Makes the Unit less vulnerable to physical Attacks of enemies and physical Attacks of an opponent.",
    counter: "Use Fire, Ice, or ColdFire attacks for full damage.",
  },
  fire: {
    name: "Fire Resistance",
    icon: "🔥",
    fullDesc: "All Fire Attacks are inefficient (halved). The enemy ignores any non-Attack effects of red cards or Unit abilities powered by red mana. Makes the Unit less vulnerable to Fire Attacks of enemies and Fire Attacks of an opponent. It also ignores non-Attack effects of opponent's red cards or Unit abilities powered by red mana.",
    counter: "Use Physical, Ice, or ColdFire attacks for full damage.",
  },
  ice: {
    name: "Ice Resistance",
    icon: "❄️",
    fullDesc: "All Ice Attacks are inefficient (halved). The enemy ignores any non-Attack effects of blue cards or Unit abilities powered by blue mana. Makes the Unit less vulnerable to Ice Attacks of enemies and Ice Attacks of an opponent. It also ignores non-Attack effects of opponent's blue cards or Unit abilities powered by blue mana.",
    counter: "Use Physical, Fire, or ColdFire attacks for full damage.",
  },
};
