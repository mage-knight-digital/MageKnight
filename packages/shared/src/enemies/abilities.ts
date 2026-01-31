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

// -----------------------------------------------------------------------------
// OFFENSIVE ABILITIES
// -----------------------------------------------------------------------------
// These abilities affect how the enemy attacks or how players must block

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
 * Summon Attack - draws a brown enemy at block phase start
 */
export const ABILITY_SUMMON = "summon" as const;

/**
 * Summon Green Attack - draws a green enemy at block phase start
 * Used by Shrouded Necromancers (Dark Crusaders faction)
 */
export const ABILITY_SUMMON_GREEN = "summon_green" as const;

/**
 * Cumbersome - can spend Move points to reduce attack
 */
export const ABILITY_CUMBERSOME = "cumbersome" as const;

/**
 * Vampiric - armor increases for each wound caused
 */
export const ABILITY_VAMPIRIC = "vampiric" as const;

/**
 * Cold Fire Attack - only Cold Fire Blocks are efficient
 */
export const ABILITY_COLD_FIRE_ATTACK = "cold_fire_attack" as const;

/**
 * Ice Attack - only Fire and Cold Fire Blocks are efficient
 */
export const ABILITY_ICE_ATTACK = "ice_attack" as const;

/**
 * Fire Attack - only Ice and Cold Fire Blocks are efficient
 */
export const ABILITY_FIRE_ATTACK = "fire_attack" as const;

/**
 * Assassination - damage cannot be assigned to Units
 */
export const ABILITY_ASSASSINATION = "assassination" as const;

// -----------------------------------------------------------------------------
// DEFENSIVE ABILITIES
// -----------------------------------------------------------------------------
// These abilities affect how the enemy defends or how it can be targeted

/**
 * Fortified - only Siege attacks can target in ranged phase
 */
export const ABILITY_FORTIFIED = "fortified" as const;

/**
 * Unfortified - enemy ignores site fortification (e.g., summoned enemies)
 */
export const ABILITY_UNFORTIFIED = "unfortified" as const;

/**
 * Elusive - has increased armor value, lower value used only if all attacks blocked
 */
export const ABILITY_ELUSIVE = "elusive" as const;

/**
 * Arcane Immunity - not affected by non-Attack/Block effects
 */
export const ABILITY_ARCANE_IMMUNITY = "arcane_immunity" as const;

/**
 * Defend - enemy defends itself or other enemies when attacked
 */
export const ABILITY_DEFEND = "defend" as const;

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
  | typeof ABILITY_SUMMON_GREEN
  | typeof ABILITY_CUMBERSOME
  | typeof ABILITY_VAMPIRIC
  | typeof ABILITY_COLD_FIRE_ATTACK
  | typeof ABILITY_ICE_ATTACK
  | typeof ABILITY_FIRE_ATTACK
  | typeof ABILITY_ELUSIVE
  | typeof ABILITY_ARCANE_IMMUNITY
  | typeof ABILITY_ASSASSINATION
  | typeof ABILITY_DEFEND;

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
 *
 * The `icon` field is a GameIconType string that maps to an actual icon asset.
 *
 * Abilities are organized by category:
 * - Offensive: Affect enemy attacks or blocking requirements
 * - Defensive: Affect enemy defense or targeting restrictions
 */
export const ABILITY_DESCRIPTIONS: Record<EnemyAbilityType, AbilityDescription> = {
  // ===========================================================================
  // OFFENSIVE ABILITIES
  // ===========================================================================
  [ABILITY_SWIFT]: {
    name: "Swift",
    shortDesc: "requires 2x Block",
    fullDesc: "To block this enemy, you need twice as much Block as its Attack value.",
    icon: "swift",
  },
  [ABILITY_BRUTAL]: {
    name: "Brutal",
    shortDesc: "deals 2x damage",
    fullDesc: "If unblocked, it deals twice as much damage as its Attack value.",
    icon: "brutal",
  },
  [ABILITY_POISON]: {
    name: "Poison",
    shortDesc: "extra wounds",
    fullDesc: "If a Unit gets Wounded because of an attack from an enemy with Poison, it is given two Wound cards instead of one. For each Wound a Hero takes into their hand from a Poisonous attack, they also puts one Wound into their discard pile.",
    icon: "poison",
  },
  [ABILITY_PARALYZE]: {
    name: "Paralyze",
    shortDesc: "destroys units",
    fullDesc: "If a Unit gets Wounded because of an attack from an enemy with Paralyze, it is immediately destroyed (removed from the game). If a Hero takes one or more Wounds into their hand from a Paralyzing attack, they must immediately discard any non-Wound cards from their hand.",
    icon: "paralyze",
  },
  [ABILITY_SUMMON]: {
    name: "Summon Attack",
    shortDesc: "summons brown enemy",
    fullDesc: "At the start of the Block phase, draw a random Brown token for this enemy. It replaces the enemy in the Block and Assign Damage phases, then it is discarded.",
    icon: "summon",
  },
  [ABILITY_SUMMON_GREEN]: {
    name: "Summon Green Attack",
    shortDesc: "summons green enemy",
    fullDesc: "At the start of the Block phase, draw a random Green token for this enemy. It replaces the enemy in the Block and Assign Damage phases, then it is discarded. Prefers tokens from the same faction.",
    icon: "summon",
  },
  [ABILITY_CUMBERSOME]: {
    name: "Cumbersome",
    shortDesc: "spend Move to reduce",
    fullDesc: "In the Block phase, you may spend Move points; for each Move point spent, decrease one attack of a Cumbersome enemy by 1. The attack is reduced for both the Block phase and the Assign Damage phase (if not blocked). An attack reduced to 0 is considered successfully blocked. Note: You cannot use surplus Move points from the Move phase; you must play Move effects during combat.",
    icon: "cumbersome",
  },
  // ===========================================================================
  // DEFENSIVE ABILITIES
  // ===========================================================================
  [ABILITY_FORTIFIED]: {
    name: "Fortified",
    shortDesc: "Siege only in ranged",
    fullDesc: "Only Siege Attacks can be used against this enemy in the Ranged and Siege Attacks phase (no attacks at all if it also defends a fortified site).",
    icon: "fortified",
  },
  [ABILITY_UNFORTIFIED]: {
    name: "Unfortified",
    shortDesc: "ignores site fortification",
    fullDesc: "Ignore all site fortifications for such enemies (if they are the garrison of a fortified site, and/or when attacked over a wall).",
    icon: "unfortified",
  },
  [ABILITY_VAMPIRIC]: {
    name: "Vampiric",
    shortDesc: "armor +1 per wound",
    fullDesc: "An enemy with the Vampiric ability has its Armor value increased by 1, for the rest of the combat, for each unit its attacks wound and for each wound its attacks cause to be added to a player's hand.",
    icon: "vampiric",
  },
  [ABILITY_COLD_FIRE_ATTACK]: {
    name: "Cold Fire Attack",
    shortDesc: "only Cold Fire Blocks efficient",
    fullDesc: "Only Cold Fire Blocks are efficient when blocking this (others are halved).",
    icon: "ice",
  },
  [ABILITY_ICE_ATTACK]: {
    name: "Ice Attack",
    shortDesc: "only Fire/Cold Fire Blocks efficient",
    fullDesc: "Only Fire and Cold Fire Blocks are efficient when blocking this (others are halved).",
    icon: "ice",
  },
  [ABILITY_FIRE_ATTACK]: {
    name: "Fire Attack",
    shortDesc: "only Ice/Cold Fire Blocks efficient",
    fullDesc: "Only Ice and Cold Fire Blocks are efficient when blocking this (others are halved).",
    icon: "fire",
  },
  [ABILITY_ELUSIVE]: {
    name: "Elusive",
    shortDesc: "increased armor value",
    fullDesc: "An elusive enemy has two Armor values. In the Ranged and Siege Attack phase, the higher value is always used. If you block the enemy attack successfully (if the enemy has multiple attacks, you have to block them all), the lower Armor value is used in the Attack phase. If you do not block it (let it deal damage or prevent it from attacking), it keeps using the higher value for the rest of the combat. If an attack value is reduced to zero during the Block phase, it is considered successfully blocked. Any Armor modifications apply simultaneously to both values.",
    icon: "armor",
  },
  [ABILITY_ARCANE_IMMUNITY]: {
    name: "Arcane Immunity",
    shortDesc: "immune to non-Attack/Block effects",
    fullDesc: "The enemy is not affected by any non-Attack/non-Block effects from any source (e.g., effects that destroy, prevent attacking, or reduce Armor). Attacks and Blocks of any elements work normally. If an effect has both Attack/Block parts and other parts, only the Attack/Block parts apply. While the enemy itself is protected, its attacks are not; effects that target the enemy's attack (not the enemy) still work.",
    icon: "arcane_immune",
  },
  [ABILITY_ASSASSINATION]: {
    name: "Assassination",
    shortDesc: "damage to hero only",
    fullDesc: "Enemies with Assassination go directly after your Hero. If the attack is not blocked, the damage cannot be assigned to Units; it must be assigned to the Hero entirely, including any additional effects. It can still be blocked with help of Units.",
    icon: "attack",
  },
  [ABILITY_DEFEND]: {
    name: "Defend",
    shortDesc: "defends self or others",
    fullDesc: "Enemies with the Defend ability will defend themselves or other enemies when you attack them.",
    icon: "block",
  },
};
