/**
 * Enemy Resistance Constants
 *
 * Defines individual resistance type constants and array-based resistance
 * configurations for enemies. This approach avoids the combinatorial explosion
 * of having a separate constant for every possible resistance combination.
 *
 * @module enemies/resistances
 */

// =============================================================================
// RESISTANCE TYPE CONSTANTS
// =============================================================================

/**
 * Physical resistance - halves physical attacks
 */
export const RESIST_PHYSICAL = "physical" as const;

/**
 * Fire resistance - halves fire attacks
 */
export const RESIST_FIRE = "fire" as const;

/**
 * Ice resistance - halves ice attacks
 */
export const RESIST_ICE = "ice" as const;

/**
 * Resistance type - individual resistance constants
 */
export type ResistanceType =
  | typeof RESIST_PHYSICAL
  | typeof RESIST_FIRE
  | typeof RESIST_ICE;

// =============================================================================
// RESISTANCE DESCRIPTIONS (Rulebook text)
// =============================================================================

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
