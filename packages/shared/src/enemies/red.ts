/**
 * Red Enemy Definitions - Draconum (Dragons)
 *
 * Red enemies are the mighty Draconum - powerful dragons that
 * roam the land. They are the strongest enemies in the game,
 * with fame ranging from 7-9. Each dragon has unique elemental
 * attacks and resistances.
 *
 * @module enemies/red
 *
 * @remarks Enemies in this module:
 * - Swamp Dragon - Swift, poison, high armor
 * - Fire Dragon - Fire attack, physical + fire resistance
 * - Ice Dragon - Ice attack, physical + ice resistance, paralyze
 * - High Dragon - ColdFire attack, fire + ice resistance, brutal
 */

import {
  ELEMENT_PHYSICAL,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_COLD_FIRE,
} from "../elements.js";
import { ENEMY_COLOR_RED, type EnemyDefinition } from "./types.js";
import {
  ABILITY_SWIFT,
  ABILITY_POISON,
  ABILITY_PARALYZE,
  ABILITY_BRUTAL,
} from "./abilities.js";
import {
  NO_RESISTANCES,
  FIRE_ICE_RESISTANCE,
  PHYSICAL_FIRE_RESISTANCE,
  PHYSICAL_ICE_RESISTANCE,
} from "./resistances.js";

// =============================================================================
// RED ENEMY ID CONSTANTS
// =============================================================================

export const ENEMY_SWAMP_DRAGON = "swamp_dragon" as const;
export const ENEMY_FIRE_DRAGON = "fire_dragon" as const;
export const ENEMY_ICE_DRAGON = "ice_dragon" as const;
export const ENEMY_HIGH_DRAGON = "high_dragon" as const;

/**
 * Union type of all red (Draconum) enemy IDs
 */
export type RedEnemyId =
  | typeof ENEMY_SWAMP_DRAGON
  | typeof ENEMY_FIRE_DRAGON
  | typeof ENEMY_ICE_DRAGON
  | typeof ENEMY_HIGH_DRAGON;

// =============================================================================
// RED ENEMY DEFINITIONS
// =============================================================================

export const RED_ENEMIES: Record<RedEnemyId, EnemyDefinition> = {
  [ENEMY_SWAMP_DRAGON]: {
    id: ENEMY_SWAMP_DRAGON,
    name: "Swamp Dragon",
    color: ENEMY_COLOR_RED,
    attack: 5,
    attackElement: ELEMENT_PHYSICAL,
    armor: 9,
    fame: 7,
    resistances: NO_RESISTANCES,
    abilities: [ABILITY_SWIFT, ABILITY_POISON],
  },
  [ENEMY_FIRE_DRAGON]: {
    id: ENEMY_FIRE_DRAGON,
    name: "Fire Dragon",
    color: ENEMY_COLOR_RED,
    attack: 9,
    attackElement: ELEMENT_FIRE,
    armor: 7,
    fame: 8,
    resistances: PHYSICAL_FIRE_RESISTANCE,
    abilities: [],
  },
  [ENEMY_ICE_DRAGON]: {
    id: ENEMY_ICE_DRAGON,
    name: "Ice Dragon",
    color: ENEMY_COLOR_RED,
    attack: 6,
    attackElement: ELEMENT_ICE,
    armor: 7,
    fame: 8,
    resistances: PHYSICAL_ICE_RESISTANCE,
    abilities: [ABILITY_PARALYZE],
  },
  [ENEMY_HIGH_DRAGON]: {
    id: ENEMY_HIGH_DRAGON,
    name: "High Dragon",
    color: ENEMY_COLOR_RED,
    attack: 6,
    attackElement: ELEMENT_COLD_FIRE,
    armor: 9,
    fame: 9,
    resistances: FIRE_ICE_RESISTANCE,
    abilities: [ABILITY_BRUTAL],
  },
};
