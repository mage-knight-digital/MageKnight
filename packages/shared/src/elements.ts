/**
 * Element constants for attacks, blocks, and resistances.
 *
 * Single source of truth: shared across client/server/core.
 */

export const ELEMENT_PHYSICAL = "physical" as const;
export const ELEMENT_FIRE = "fire" as const;
export const ELEMENT_ICE = "ice" as const;
export const ELEMENT_COLD_FIRE = "cold_fire" as const;

export type Element =
  | typeof ELEMENT_PHYSICAL
  | typeof ELEMENT_FIRE
  | typeof ELEMENT_ICE
  | typeof ELEMENT_COLD_FIRE;

// Convenience arrays
export const BASIC_ELEMENTS = [
  ELEMENT_PHYSICAL,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_COLD_FIRE,
] as const;


