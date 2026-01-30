/**
 * Faction Leader Definitions
 *
 * Faction leaders are large multi-level boss enemies from the Shades of Tezla
 * expansion. They represent different avatars of Tezla and have level-based
 * stats that determine their Armor and Attack values.
 *
 * Key properties:
 * - Level-based stats (Armor and Attacks vary by level 1-4)
 * - Arcane Immunity ability (immune to non-Attack/Block effects)
 * - Count as enemy tokens for card effects
 * - Scenario sets initial level
 *
 * @module enemies/factionLeaders
 */

import type { EnemyDefinition, Faction } from "./types.js";
import {
  ENEMY_COLOR_WHITE,
  FACTION_ELEMENTALIST,
  FACTION_DARK_CRUSADERS,
} from "./types.js";
import { ABILITY_ARCANE_IMMUNITY } from "./abilities.js";
import { ELEMENT_PHYSICAL, ELEMENT_FIRE, ELEMENT_ICE } from "../elements.js";
import { FIRE_RESISTANCE, ICE_RESISTANCE } from "./resistances.js";

// =============================================================================
// FACTION LEADER TYPE DEFINITIONS
// =============================================================================

/**
 * Attack information for a single attack action.
 * Faction leaders may have multiple attacks at higher levels.
 */
export interface FactionLeaderAttack {
  readonly value: number;
  readonly element: typeof ELEMENT_PHYSICAL | typeof ELEMENT_FIRE | typeof ELEMENT_ICE;
}

/**
 * Stats for a faction leader at a specific level.
 * These values are used instead of the base EnemyDefinition stats when
 * the leader is in combat at that level.
 */
export interface FactionLeaderLevelStats {
  readonly armor: number;
  readonly attacks: readonly FactionLeaderAttack[];
}

/**
 * Faction leader definition extending the base enemy definition.
 * Adds level-based stat lookups and marks the enemy as a faction leader.
 */
export interface FactionLeaderDefinition extends Omit<EnemyDefinition, "attack" | "attackElement"> {
  /** Discriminator to identify faction leader definitions */
  readonly isFactionLeader: true;

  /** Faction is required for faction leaders (not optional) */
  readonly faction: Faction;

  /**
   * Stats lookup by level (1-4).
   * The scenario specifies the initial level, which determines
   * which stats are used in combat.
   */
  readonly levelStats: Readonly<Record<number, FactionLeaderLevelStats>>;

  /**
   * Base attack value (for compatibility with EnemyDefinition).
   * Use levelStats for actual combat values.
   */
  readonly attack: 0;

  /**
   * Base attack element (for compatibility with EnemyDefinition).
   * Individual attacks in levelStats may have different elements.
   */
  readonly attackElement: typeof ELEMENT_PHYSICAL;
}

// =============================================================================
// FACTION LEADER ID CONSTANTS
// =============================================================================

/**
 * Elementalist faction leader - Avatar of Tezla for the Elementalist faction.
 * Uses elemental attacks (Fire and Ice) at higher levels.
 */
export const ENEMY_ELEMENTALIST_LEADER = "elementalist_leader" as const;

/**
 * Dark Crusader faction leader - Avatar of Tezla for the Dark Crusaders faction.
 * Uses physical attacks with increasing power at higher levels.
 */
export const ENEMY_DARK_CRUSADER_LEADER = "dark_crusader_leader" as const;

/**
 * Union type of all faction leader IDs
 */
export type FactionLeaderId =
  | typeof ENEMY_ELEMENTALIST_LEADER
  | typeof ENEMY_DARK_CRUSADER_LEADER;

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Check if an enemy definition is a faction leader.
 */
export function isFactionLeaderDefinition(
  def: EnemyDefinition | FactionLeaderDefinition
): def is FactionLeaderDefinition {
  return "isFactionLeader" in def && def.isFactionLeader === true;
}

// =============================================================================
// FACTION LEADER DEFINITIONS
// =============================================================================

/**
 * Complete registry of faction leader definitions.
 *
 * Note: Stats are placeholder values pending rulebook verification.
 * Level stats follow a progression pattern:
 * - Higher levels have higher armor
 * - Higher levels may have multiple attacks
 * - Higher levels may have elemental attacks
 */
export const FACTION_LEADERS: Readonly<Record<FactionLeaderId, FactionLeaderDefinition>> = {
  [ENEMY_ELEMENTALIST_LEADER]: {
    id: ENEMY_ELEMENTALIST_LEADER,
    name: "Elementalist",
    color: ENEMY_COLOR_WHITE,
    isFactionLeader: true,
    faction: FACTION_ELEMENTALIST,
    // Base stats (for EnemyDefinition compatibility)
    attack: 0,
    attackElement: ELEMENT_PHYSICAL,
    armor: 0, // Use levelStats
    fame: 12,
    resistances: FIRE_RESISTANCE, // Elementalist has fire resistance
    abilities: [ABILITY_ARCANE_IMMUNITY],
    // Level-based stats
    levelStats: {
      1: {
        armor: 6,
        attacks: [{ value: 4, element: ELEMENT_PHYSICAL }],
      },
      2: {
        armor: 8,
        attacks: [
          { value: 5, element: ELEMENT_FIRE },
          { value: 3, element: ELEMENT_PHYSICAL },
        ],
      },
      3: {
        armor: 10,
        attacks: [
          { value: 6, element: ELEMENT_FIRE },
          { value: 4, element: ELEMENT_ICE },
        ],
      },
      4: {
        armor: 12,
        attacks: [
          { value: 7, element: ELEMENT_FIRE },
          { value: 5, element: ELEMENT_ICE },
          { value: 3, element: ELEMENT_PHYSICAL },
        ],
      },
    },
  },
  [ENEMY_DARK_CRUSADER_LEADER]: {
    id: ENEMY_DARK_CRUSADER_LEADER,
    name: "Dark Crusader",
    color: ENEMY_COLOR_WHITE,
    isFactionLeader: true,
    faction: FACTION_DARK_CRUSADERS,
    // Base stats (for EnemyDefinition compatibility)
    attack: 0,
    attackElement: ELEMENT_PHYSICAL,
    armor: 0, // Use levelStats
    fame: 12,
    resistances: ICE_RESISTANCE, // Dark Crusader has ice resistance
    abilities: [ABILITY_ARCANE_IMMUNITY],
    // Level-based stats
    levelStats: {
      1: {
        armor: 7,
        attacks: [{ value: 5, element: ELEMENT_PHYSICAL }],
      },
      2: {
        armor: 9,
        attacks: [{ value: 6, element: ELEMENT_PHYSICAL }],
      },
      3: {
        armor: 11,
        attacks: [
          { value: 7, element: ELEMENT_PHYSICAL },
          { value: 4, element: ELEMENT_ICE },
        ],
      },
      4: {
        armor: 13,
        attacks: [
          { value: 8, element: ELEMENT_PHYSICAL },
          { value: 6, element: ELEMENT_ICE },
        ],
      },
    },
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get a faction leader definition by ID.
 * Returns undefined if the ID is not a faction leader.
 */
export function getFactionLeader(id: FactionLeaderId): FactionLeaderDefinition {
  return FACTION_LEADERS[id];
}

/**
 * Get the stats for a faction leader at a specific level.
 * Defaults to level 1 if the specified level is out of range.
 *
 * @param leader - The faction leader definition
 * @param level - The current level (1-4)
 * @returns The stats for that level
 */
export function getFactionLeaderLevelStats(
  leader: FactionLeaderDefinition,
  level: number
): FactionLeaderLevelStats {
  // Clamp level to valid range (1-4)
  const validLevel = Math.min(Math.max(level, 1), 4);
  const stats = leader.levelStats[validLevel];
  if (stats) return stats;
  // Fallback to level 1 (always exists)
  const fallback = leader.levelStats[1];
  if (!fallback) {
    throw new Error(`Faction leader ${leader.id} is missing level 1 stats`);
  }
  return fallback;
}

/**
 * Get all faction leader IDs.
 */
export function getAllFactionLeaderIds(): readonly FactionLeaderId[] {
  return Object.keys(FACTION_LEADERS) as FactionLeaderId[];
}

/**
 * Check if an enemy ID is a faction leader ID.
 */
export function isFactionLeaderId(id: string): id is FactionLeaderId {
  return id in FACTION_LEADERS;
}
