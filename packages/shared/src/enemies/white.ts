/**
 * White Enemy Definitions - City Garrison
 *
 * White enemies defend cities and are among the strongest non-dragon
 * enemies. Fame ranges from 4-8. They include elite golems with
 * elemental attacks and the powerful Altem forces.
 *
 * @module enemies/white
 *
 * @remarks Enemies in this module:
 * - Thugs - Basic city guards
 * - Shocktroops - Swift and brutal elite soldiers
 * - Ice Golems - Ice attack, physical resistance, paralyze
 * - Freezers - ColdFire attack, paralyze
 * - Altem Guardsmen - Elite fortified guards
 * - Altem Mages - Powerful mages with ColdFire attack
 */

import {
  ELEMENT_PHYSICAL,
  ELEMENT_ICE,
  ELEMENT_COLD_FIRE,
} from "../elements.js";
import { ENEMY_COLOR_WHITE, type EnemyDefinition } from "./types.js";
import {
  ABILITY_SWIFT,
  ABILITY_BRUTAL,
  ABILITY_PARALYZE,
  ABILITY_FORTIFIED,
} from "./abilities.js";
import {
  NO_RESISTANCES,
  PHYSICAL_RESISTANCE,
  FIRE_ICE_RESISTANCE,
} from "./resistances.js";

// =============================================================================
// WHITE ENEMY ID CONSTANTS
// =============================================================================

export const ENEMY_THUGS = "thugs" as const;
export const ENEMY_SHOCKTROOPS = "shocktroops" as const;
export const ENEMY_ICE_GOLEMS = "ice_golems" as const;
export const ENEMY_FREEZERS = "freezers" as const;
export const ENEMY_ALTEM_GUARDSMEN = "altem_guardsmen" as const;
export const ENEMY_ALTEM_MAGES = "altem_mages" as const;

/**
 * Union type of all white (City garrison) enemy IDs
 */
export type WhiteEnemyId =
  | typeof ENEMY_THUGS
  | typeof ENEMY_SHOCKTROOPS
  | typeof ENEMY_ICE_GOLEMS
  | typeof ENEMY_FREEZERS
  | typeof ENEMY_ALTEM_GUARDSMEN
  | typeof ENEMY_ALTEM_MAGES;

// =============================================================================
// WHITE ENEMY DEFINITIONS
// =============================================================================

export const WHITE_ENEMIES: Record<WhiteEnemyId, EnemyDefinition> = {
  [ENEMY_THUGS]: {
    id: ENEMY_THUGS,
    name: "Thugs",
    color: ENEMY_COLOR_WHITE,
    attack: 6,
    attackElement: ELEMENT_PHYSICAL,
    armor: 5,
    fame: 5,
    resistances: NO_RESISTANCES,
    abilities: [],
  },
  [ENEMY_SHOCKTROOPS]: {
    id: ENEMY_SHOCKTROOPS,
    name: "Shocktroops",
    color: ENEMY_COLOR_WHITE,
    attack: 5,
    attackElement: ELEMENT_PHYSICAL,
    armor: 5,
    fame: 5,
    resistances: NO_RESISTANCES,
    abilities: [ABILITY_SWIFT, ABILITY_BRUTAL],
  },
  [ENEMY_ICE_GOLEMS]: {
    id: ENEMY_ICE_GOLEMS,
    name: "Ice Golems",
    color: ENEMY_COLOR_WHITE,
    attack: 4,
    attackElement: ELEMENT_ICE,
    armor: 5,
    fame: 5,
    resistances: PHYSICAL_RESISTANCE,
    abilities: [ABILITY_PARALYZE],
  },
  [ENEMY_FREEZERS]: {
    id: ENEMY_FREEZERS,
    name: "Freezers",
    color: ENEMY_COLOR_WHITE,
    attack: 3,
    attackElement: ELEMENT_COLD_FIRE,
    armor: 4,
    fame: 4,
    resistances: NO_RESISTANCES,
    abilities: [ABILITY_PARALYZE],
  },
  [ENEMY_ALTEM_GUARDSMEN]: {
    id: ENEMY_ALTEM_GUARDSMEN,
    name: "Altem Guardsmen",
    color: ENEMY_COLOR_WHITE,
    attack: 6,
    attackElement: ELEMENT_PHYSICAL,
    armor: 6,
    fame: 6,
    resistances: NO_RESISTANCES,
    abilities: [ABILITY_FORTIFIED],
  },
  [ENEMY_ALTEM_MAGES]: {
    id: ENEMY_ALTEM_MAGES,
    name: "Altem Mages",
    color: ENEMY_COLOR_WHITE,
    attack: 6,
    attackElement: ELEMENT_COLD_FIRE,
    armor: 6,
    fame: 8,
    resistances: FIRE_ICE_RESISTANCE,
    abilities: [ABILITY_BRUTAL],
  },
};

// =============================================================================
// TEST ALIASES (backward-compatible for tests)
// =============================================================================

/**
 * @deprecated Use ENEMY_ICE_GOLEMS directly
 */
export const ENEMY_ICE_GOLEM = ENEMY_ICE_GOLEMS;
