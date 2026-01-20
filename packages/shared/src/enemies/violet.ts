/**
 * Violet Enemy Definitions - Mage Tower Defenders
 *
 * Violet enemies defend mage towers. They are magical enemies
 * with elemental attacks and resistances. Fame ranges from 5-6.
 * Ice Mages have ice resistance, Fire Mages have fire resistance,
 * and Sorcerers resist both fire and ice.
 *
 * @module enemies/violet
 *
 * @remarks Enemies in this module:
 * - Monks - Poison-wielding martial artists
 * - Illusionists - Physical resistance, illusion magic
 * - Ice Mages - Ice attack, ice resistance
 * - Fire Mages - Fire attack, fire resistance
 * - Sorcerers - ColdFire attack, fire and ice resistance, assassination, poison, arcane immunity
 */

import {
  ELEMENT_PHYSICAL,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_COLD_FIRE,
} from "../elements.js";
import { ENEMY_COLOR_VIOLET, type EnemyDefinition } from "./types.js";
import {
  ABILITY_POISON,
  ABILITY_SUMMON,
  ABILITY_ASSASSINATION,
  ABILITY_ARCANE_IMMUNITY,
} from "./abilities.js";
import {
  NO_RESISTANCES,
  PHYSICAL_RESISTANCE,
  FIRE_RESISTANCE,
  ICE_RESISTANCE,
  FIRE_ICE_RESISTANCE,
} from "./resistances.js";

// =============================================================================
// VIOLET ENEMY ID CONSTANTS
// =============================================================================

export const ENEMY_MONKS = "monks" as const;
export const ENEMY_ILLUSIONISTS = "illusionists" as const;
export const ENEMY_ICE_MAGES = "ice_mages" as const;
export const ENEMY_FIRE_MAGES = "fire_mages" as const;
export const ENEMY_SORCERERS = "sorcerers" as const;

/**
 * Union type of all violet (Mage Tower) enemy IDs
 */
export type VioletEnemyId =
  | typeof ENEMY_MONKS
  | typeof ENEMY_ILLUSIONISTS
  | typeof ENEMY_ICE_MAGES
  | typeof ENEMY_FIRE_MAGES
  | typeof ENEMY_SORCERERS;

// =============================================================================
// VIOLET ENEMY DEFINITIONS
// =============================================================================

export const VIOLET_ENEMIES: Record<VioletEnemyId, EnemyDefinition> = {
  [ENEMY_MONKS]: {
    id: ENEMY_MONKS,
    name: "Monks",
    color: ENEMY_COLOR_VIOLET,
    attack: 5,
    attackElement: ELEMENT_PHYSICAL,
    armor: 4,
    fame: 5,
    resistances: NO_RESISTANCES,
    abilities: [ABILITY_POISON],
  },
  [ENEMY_ILLUSIONISTS]: {
    id: ENEMY_ILLUSIONISTS,
    name: "Illusionists",
    color: ENEMY_COLOR_VIOLET,
    attack: 0, // Summoners don't attack directly
    attackElement: ELEMENT_PHYSICAL,
    armor: 3,
    fame: 4,
    resistances: PHYSICAL_RESISTANCE,
    abilities: [ABILITY_SUMMON], // Summons brown enemy
  },
  [ENEMY_ICE_MAGES]: {
    id: ENEMY_ICE_MAGES,
    name: "Ice Mages",
    color: ENEMY_COLOR_VIOLET,
    attack: 5,
    attackElement: ELEMENT_ICE,
    armor: 6,
    fame: 5,
    resistances: ICE_RESISTANCE,
    abilities: [],
  },
  [ENEMY_FIRE_MAGES]: {
    id: ENEMY_FIRE_MAGES,
    name: "Fire Mages",
    color: ENEMY_COLOR_VIOLET,
    attack: 6,
    attackElement: ELEMENT_FIRE,
    armor: 5,
    fame: 5,
    resistances: FIRE_RESISTANCE,
    abilities: [],
  },
  [ENEMY_SORCERERS]: {
    id: ENEMY_SORCERERS,
    name: "Sorcerers",
    color: ENEMY_COLOR_VIOLET,
    attack: 6,
    attackElement: ELEMENT_COLD_FIRE,
    armor: 6,
    fame: 5,
    resistances: FIRE_ICE_RESISTANCE,
    abilities: [ABILITY_ASSASSINATION, ABILITY_POISON, ABILITY_ARCANE_IMMUNITY],
  },
};

// =============================================================================
// TEST ALIASES (backward-compatible for tests)
// =============================================================================

/**
 * @deprecated Use ENEMY_FIRE_MAGES directly
 */
export const ENEMY_FIRE_MAGE = ENEMY_FIRE_MAGES;
