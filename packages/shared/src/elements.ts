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

// =============================================================================
// ATTACK ELEMENT DESCRIPTIONS
// =============================================================================

/**
 * Description for attack element UI display
 */
export interface AttackElementDescription {
  readonly name: string;
  /** Short description for inline display */
  readonly shortDesc: string;
  /** Full description for rulebook/reference panel */
  readonly fullDesc: string;
  /** Icon hint for UI (GameIconType string) */
  readonly icon: string;
}

/**
 * Descriptions for elemental attacks (non-physical).
 * Source: Mage Knight Ultimate Edition Rulebook
 *
 * Physical attacks don't need special explanation, so only elemental attacks are listed.
 */
export const ATTACK_ELEMENT_DESCRIPTIONS: Partial<Record<Element, AttackElementDescription>> = {
  [ELEMENT_FIRE]: {
    name: "Fire Attack",
    shortDesc: "Ice/ColdFire Block efficient",
    fullDesc: "Only Ice and Cold Fire Blocks are efficient when blocking this attack. Physical and Fire Blocks are halved.",
    icon: "fire",
  },
  [ELEMENT_ICE]: {
    name: "Ice Attack",
    shortDesc: "Fire/ColdFire Block efficient",
    fullDesc: "Only Fire and Cold Fire Blocks are efficient when blocking this attack. Physical and Ice Blocks are halved.",
    icon: "ice",
  },
  [ELEMENT_COLD_FIRE]: {
    name: "Cold Fire Attack",
    shortDesc: "only ColdFire Block efficient",
    fullDesc: "Only Cold Fire Blocks are efficient when blocking this attack. Physical, Fire, and Ice Blocks are all halved.",
    icon: "cold_fire",
  },
};
