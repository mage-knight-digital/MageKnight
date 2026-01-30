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
 * - Swamp Dragon - Swift, paralyze, high armor
 * - Fire Dragon - Fire attack, physical + fire resistance
 * - Ice Dragon - Ice attack, physical + ice resistance, paralyze
 * - High Dragon - ColdFire attack, fire + ice resistance, brutal
 * - Death Dragon - Assassination, paralyze, Dark Crusaders faction
 */

import {
  ELEMENT_PHYSICAL,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_COLD_FIRE,
} from "../elements.js";
import {
  ENEMY_COLOR_RED,
  FACTION_DARK_CRUSADERS,
  type EnemyDefinition,
} from "./types.js";
import {
  ABILITY_SWIFT,
  ABILITY_PARALYZE,
  ABILITY_BRUTAL,
  ABILITY_ASSASSINATION,
} from "./abilities.js";
import { RESIST_PHYSICAL, RESIST_FIRE, RESIST_ICE } from "./resistances.js";

// =============================================================================
// RED ENEMY ID CONSTANTS
// =============================================================================

export const ENEMY_SWAMP_DRAGON = "swamp_dragon" as const;
export const ENEMY_FIRE_DRAGON = "fire_dragon" as const;
export const ENEMY_ICE_DRAGON = "ice_dragon" as const;
export const ENEMY_HIGH_DRAGON = "high_dragon" as const;
export const ENEMY_DEATH_DRAGON = "death_dragon" as const;

/**
 * Union type of all red (Draconum) enemy IDs
 */
export type RedEnemyId =
  | typeof ENEMY_SWAMP_DRAGON
  | typeof ENEMY_FIRE_DRAGON
  | typeof ENEMY_ICE_DRAGON
  | typeof ENEMY_HIGH_DRAGON
  | typeof ENEMY_DEATH_DRAGON;

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
    resistances: [],
    abilities: [ABILITY_SWIFT, ABILITY_PARALYZE],
  },
  [ENEMY_FIRE_DRAGON]: {
    id: ENEMY_FIRE_DRAGON,
    name: "Fire Dragon",
    color: ENEMY_COLOR_RED,
    attack: 9,
    attackElement: ELEMENT_FIRE,
    armor: 7,
    fame: 8,
    resistances: [RESIST_PHYSICAL, RESIST_FIRE],
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
    resistances: [RESIST_PHYSICAL, RESIST_ICE],
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
    resistances: [RESIST_FIRE, RESIST_ICE],
    abilities: [ABILITY_BRUTAL],
  },
  [ENEMY_DEATH_DRAGON]: {
    id: ENEMY_DEATH_DRAGON,
    name: "Death Dragon",
    color: ENEMY_COLOR_RED,
    attack: 7,
    attackElement: ELEMENT_PHYSICAL,
    armor: 9,
    fame: 6,
    resistances: [],
    abilities: [ABILITY_ASSASSINATION, ABILITY_PARALYZE],
    faction: FACTION_DARK_CRUSADERS,
  },
};
