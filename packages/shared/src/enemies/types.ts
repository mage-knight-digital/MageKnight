/**
 * Enemy Type Definitions
 *
 * Core interfaces and type constants for the enemy system.
 * This module defines the structural contracts that all enemy
 * definitions must follow.
 *
 * @module enemies/types
 */

import type { Element } from "../elements.js";
import type { EnemyAbilityType } from "./abilities.js";
import type { ResistanceType } from "./resistances.js";

// =============================================================================
// ENEMY COLOR CONSTANTS
// =============================================================================

/**
 * Green token back - Marauding Orcs found roaming the countryside
 */
export const ENEMY_COLOR_GREEN = "green" as const;

/**
 * Gray token back - Keep garrison defenders
 */
export const ENEMY_COLOR_GRAY = "gray" as const;

/**
 * Brown token back - Dungeon and tomb monsters (tan in TTS)
 */
export const ENEMY_COLOR_BROWN = "brown" as const;

/**
 * Violet token back - Mage Tower defenders
 */
export const ENEMY_COLOR_VIOLET = "violet" as const;

/**
 * Red token back - Draconum (powerful dragons)
 */
export const ENEMY_COLOR_RED = "red" as const;

/**
 * White token back - City garrison defenders
 */
export const ENEMY_COLOR_WHITE = "white" as const;

/**
 * Enemy color type representing the token back color which indicates
 * where enemies appear on the map
 */
export type EnemyColor =
  | typeof ENEMY_COLOR_GREEN
  | typeof ENEMY_COLOR_GRAY
  | typeof ENEMY_COLOR_BROWN
  | typeof ENEMY_COLOR_VIOLET
  | typeof ENEMY_COLOR_RED
  | typeof ENEMY_COLOR_WHITE;

// =============================================================================
// ENEMY FACTIONS
// =============================================================================

/**
 * Elementalist faction - enemies associated with the Elementalist expansion
 */
export const FACTION_ELEMENTALIST = "elementalist" as const;

/**
 * Dark Crusaders faction - enemies associated with the Dark Crusaders expansion
 */
export const FACTION_DARK_CRUSADERS = "dark_crusaders" as const;

/**
 * Enemy faction type - optional grouping for expansion-specific enemies
 */
export type Faction = typeof FACTION_ELEMENTALIST | typeof FACTION_DARK_CRUSADERS;

// =============================================================================
// ENEMY RESISTANCES
// =============================================================================

/**
 * Enemy elemental resistances - array of resistance types
 *
 * Uses an array of individual resistance constants instead of a boolean object.
 * This avoids the combinatorial explosion of having separate constants for
 * every possible combination (2^n constants for n resistance types).
 *
 * @example
 * // No resistances
 * resistances: []
 *
 * // Physical resistance only
 * resistances: [RESIST_PHYSICAL]
 *
 * // Physical, Fire, and Ice resistance
 * resistances: [RESIST_PHYSICAL, RESIST_FIRE, RESIST_ICE]
 */
export type EnemyResistances = readonly ResistanceType[];

// =============================================================================
// ENEMY ATTACK
// =============================================================================

/**
 * Single attack instance for enemies with multiple attacks.
 * Each attack is handled separately during block and damage phases.
 *
 * Per the rulebook:
 * - Attacks are handled separately, one by one, in any order
 * - Cannot group attacks into single block - each needs its own block value
 * - "Successfully blocked" means ALL attacks are blocked (for Disease, Counterattack, Elusive)
 */
export interface EnemyAttack {
  /** Raw damage value of this attack */
  readonly damage: number;
  /** Elemental type of this attack */
  readonly element: Element;
}

// =============================================================================
// ENEMY DEFINITION
// =============================================================================

/**
 * Complete enemy definition containing all stats and properties
 */
export interface EnemyDefinition {
  readonly id: EnemyId;
  readonly name: string;
  readonly color: EnemyColor;
  /** Legacy attack value - used when attacks array is absent */
  readonly attack: number;
  /** Legacy attack element - used when attacks array is absent */
  readonly attackElement: Element;
  readonly armor: number;
  readonly fame: number;
  readonly resistances: EnemyResistances;
  readonly abilities: readonly EnemyAbilityType[];
  readonly faction?: Faction;
  /**
   * Multiple attacks for enemies that attack more than once.
   * When present, this overrides the single attack/attackElement fields.
   * Each attack is handled separately during block and damage phases.
   */
  readonly attacks?: readonly EnemyAttack[];
  /**
   * Optional reputation penalty applied when this enemy is defeated.
   * Positive number (e.g., 1 means lose 1 reputation).
   * Used for enemies like Heroes who cause reputation loss when killed.
   */
  readonly reputationPenalty?: number;
}

// =============================================================================
// ENEMY ID IMPORTS (forward declaration for circular dependency)
// =============================================================================

// Import enemy IDs from faction modules
import type { GreenEnemyId } from "./green.js";
import type { GrayEnemyId } from "./gray.js";
import type { BrownEnemyId } from "./brown.js";
import type { VioletEnemyId } from "./violet.js";
import type { WhiteEnemyId } from "./white.js";
import type { RedEnemyId } from "./red.js";

/**
 * Union of all enemy IDs across all factions
 */
export type EnemyId =
  | GreenEnemyId
  | GrayEnemyId
  | BrownEnemyId
  | VioletEnemyId
  | WhiteEnemyId
  | RedEnemyId;
