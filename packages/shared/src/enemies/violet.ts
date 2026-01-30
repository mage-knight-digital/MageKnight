/**
 * Violet Enemy Definitions - Mage Tower Defenders
 *
 * Violet enemies defend mage towers. They are magical enemies
 * with elemental attacks and resistances. Fame ranges from 4-6.
 * Ice Mages have ice resistance, Fire Mages have fire resistance.
 *
 * @module enemies/violet
 *
 * @remarks Enemies in this module:
 * - Monks - Poison-wielding martial artists
 * - Illusionists - Physical resistance, illusion magic
 * - Ice Mages - Ice attack, ice resistance
 * - Fire Mages - Fire attack, fire resistance
 * - Ice Golems - Ice attack, ice and physical resistance, paralyze
 * - Fire Golems - Fire attack, fire and physical resistance, brutal
 * - Sorcerers - Physical attack, assassination, poison, arcane immunity
 */

import {
  ELEMENT_PHYSICAL,
  ELEMENT_FIRE,
  ELEMENT_ICE,
} from "../elements.js";
import { ENEMY_COLOR_VIOLET, type EnemyDefinition } from "./types.js";
import {
  ABILITY_POISON,
  ABILITY_SUMMON,
  ABILITY_ASSASSINATION,
  ABILITY_ARCANE_IMMUNITY,
  ABILITY_PARALYZE,
  ABILITY_BRUTAL,
} from "./abilities.js";
import { RESIST_PHYSICAL, RESIST_FIRE, RESIST_ICE } from "./resistances.js";

// =============================================================================
// VIOLET ENEMY ID CONSTANTS
// =============================================================================

export const ENEMY_MONKS = "monks" as const;
export const ENEMY_ILLUSIONISTS = "illusionists" as const;
export const ENEMY_ICE_MAGES = "ice_mages" as const;
export const ENEMY_FIRE_MAGES = "fire_mages" as const;
export const ENEMY_ICE_GOLEMS = "ice_golems" as const;
export const ENEMY_FIRE_GOLEM = "fire_golem" as const;
export const ENEMY_SORCERERS = "sorcerers" as const;

/**
 * Union type of all violet (Mage Tower) enemy IDs
 */
export type VioletEnemyId =
  | typeof ENEMY_MONKS
  | typeof ENEMY_ILLUSIONISTS
  | typeof ENEMY_ICE_MAGES
  | typeof ENEMY_FIRE_MAGES
  | typeof ENEMY_ICE_GOLEMS
  | typeof ENEMY_FIRE_GOLEM
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
    armor: 5,
    fame: 4,
    resistances: [],
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
    resistances: [RESIST_PHYSICAL],
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
    resistances: [RESIST_ICE],
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
    resistances: [RESIST_FIRE],
    abilities: [],
  },
  [ENEMY_ICE_GOLEMS]: {
    id: ENEMY_ICE_GOLEMS,
    name: "Ice Golems",
    color: ENEMY_COLOR_VIOLET,
    attack: 2,
    attackElement: ELEMENT_ICE,
    armor: 4,
    fame: 5,
    resistances: [RESIST_ICE, RESIST_PHYSICAL],
    abilities: [ABILITY_PARALYZE],
  },
  [ENEMY_FIRE_GOLEM]: {
    id: ENEMY_FIRE_GOLEM,
    name: "Fire Golem",
    color: ENEMY_COLOR_VIOLET,
    attack: 3,
    attackElement: ELEMENT_FIRE,
    armor: 4,
    fame: 5,
    resistances: [RESIST_FIRE, RESIST_PHYSICAL],
    abilities: [ABILITY_BRUTAL],
  },
  [ENEMY_SORCERERS]: {
    id: ENEMY_SORCERERS,
    name: "Sorcerers",
    color: ENEMY_COLOR_VIOLET,
    attack: 6,
    attackElement: ELEMENT_PHYSICAL,
    armor: 6,
    fame: 5,
    resistances: [],
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

/**
 * @deprecated Use ENEMY_ICE_GOLEMS directly
 */
export const ENEMY_ICE_GOLEM = ENEMY_ICE_GOLEMS;
