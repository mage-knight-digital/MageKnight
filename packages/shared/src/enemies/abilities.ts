/**
 * Enemy Ability Definitions
 *
 * Constants and descriptions for all enemy special abilities.
 * These abilities modify how enemies attack, defend, or interact
 * with the combat system.
 *
 * @module enemies/abilities
 */

// =============================================================================
// ABILITY TYPE CONSTANTS
// =============================================================================

/**
 * Enemy is fortified - only Siege attacks can target in ranged phase
 */
export const ABILITY_FORTIFIED = "fortified" as const;

/**
 * Enemy ignores site fortification (e.g., summoned enemies)
 */
export const ABILITY_UNFORTIFIED = "unfortified" as const;

/**
 * Swift - requires 2x Block to fully block this enemy's attack
 */
export const ABILITY_SWIFT = "swift" as const;

/**
 * Brutal - deals 2x damage if attack is not fully blocked
 */
export const ABILITY_BRUTAL = "brutal" as const;

/**
 * Poison - wounds cause additional penalties to units and heroes
 */
export const ABILITY_POISON = "poison" as const;

/**
 * Paralyze - wounds destroy units; heroes discard non-wound cards
 */
export const ABILITY_PARALYZE = "paralyze" as const;

/**
 * Summon - draws a brown enemy at block phase start
 */
export const ABILITY_SUMMON = "summon" as const;

/**
 * Cumbersome - can spend Move points to reduce attack
 */
export const ABILITY_CUMBERSOME = "cumbersome" as const;

/**
 * Union type of all enemy ability types
 */
export type EnemyAbilityType =
  | typeof ABILITY_FORTIFIED
  | typeof ABILITY_UNFORTIFIED
  | typeof ABILITY_SWIFT
  | typeof ABILITY_BRUTAL
  | typeof ABILITY_POISON
  | typeof ABILITY_PARALYZE
  | typeof ABILITY_SUMMON
  | typeof ABILITY_CUMBERSOME;

// =============================================================================
// ABILITY DESCRIPTIONS
// =============================================================================

/**
 * Ability description for UI display
 */
export interface AbilityDescription {
  readonly name: string;
  /** Short description for inline display (e.g., tooltips) */
  readonly shortDesc: string;
  /** Full description for rulebook/reference panel */
  readonly fullDesc: string;
  /** Icon hint for UI (emoji or icon name) */
  readonly icon: string;
}

/**
 * Descriptions for all enemy abilities.
 * Source: Mage Knight Ultimate Edition Rulebook
 */
export const ABILITY_DESCRIPTIONS: Record<EnemyAbilityType, AbilityDescription> = {
  [ABILITY_SWIFT]: {
    name: "Swift",
    shortDesc: "requires 2x Block",
    fullDesc: "To block this enemy, you need twice as much Block as its Attack value.",
    icon: "⚡",
  },
  [ABILITY_BRUTAL]: {
    name: "Brutal",
    shortDesc: "deals 2x damage",
    fullDesc: "If unblocked, this enemy deals twice as much damage as its Attack value.",
    icon: "💀",
  },
  [ABILITY_POISON]: {
    name: "Poison",
    shortDesc: "extra wounds",
    fullDesc: "Units take 2 Wounds instead of 1. Heroes also put 1 Wound in discard per Wound taken to hand.",
    icon: "☠️",
  },
  [ABILITY_PARALYZE]: {
    name: "Paralyze",
    shortDesc: "destroys units",
    fullDesc: "Wounded Units are destroyed. Heroes must discard all non-Wound cards from hand when wounded.",
    icon: "🔒",
  },
  [ABILITY_SUMMON]: {
    name: "Summon",
    shortDesc: "summons brown enemy",
    fullDesc: "At Block phase start, draw a Brown enemy. It replaces the summoner for Block and Damage phases, then is discarded.",
    icon: "✨",
  },
  [ABILITY_CUMBERSOME]: {
    name: "Cumbersome",
    shortDesc: "spend Move to reduce",
    fullDesc: "In Block phase, spend Move points to reduce this attack by 1 per Move spent. Reduced to 0 = blocked.",
    icon: "🐢",
  },
  [ABILITY_FORTIFIED]: {
    name: "Fortified",
    shortDesc: "Siege only in ranged",
    fullDesc: "Only Siege Attacks can target this enemy in the Ranged/Siege phase. If also at a fortified site, no attacks at all.",
    icon: "🛡️",
  },
  [ABILITY_UNFORTIFIED]: {
    name: "Unfortified",
    shortDesc: "ignores site fortification",
    fullDesc: "Site fortifications are ignored for this enemy. Summoned enemies have this ability.",
    icon: "📍",
  },
};
