/**
 * Gray Enemy Definitions - Keep Garrison
 *
 * Gray enemies defend keeps and are stronger than green orcs.
 * They range from fame 3-4 and represent trained human soldiers.
 * Guardsmen are fortified, while Golems have physical resistance.
 *
 * @module enemies/gray
 *
 * @remarks Enemies in this module:
 * - Crossbowmen - Ranged defenders with swift ability
 * - Guardsmen - Fortified melee guards
 * - Swordsmen - Heavy infantry
 * - Golems - Physically resistant constructs
 */

import { ELEMENT_PHYSICAL } from "../elements.js";
import { ENEMY_COLOR_GRAY, type EnemyDefinition } from "./types.js";
import { ABILITY_FORTIFIED, ABILITY_SWIFT } from "./abilities.js";
import { RESIST_PHYSICAL } from "./resistances.js";

// =============================================================================
// GRAY ENEMY ID CONSTANTS
// =============================================================================

export const ENEMY_CROSSBOWMEN = "crossbowmen" as const;
export const ENEMY_GUARDSMEN = "guardsmen" as const;
export const ENEMY_SWORDSMEN = "swordsmen" as const;
export const ENEMY_GOLEMS = "golems" as const;
export const ENEMY_HEROES = "heroes" as const;

/**
 * Union type of all gray (Keep garrison) enemy IDs
 */
export type GrayEnemyId =
  | typeof ENEMY_CROSSBOWMEN
  | typeof ENEMY_GUARDSMEN
  | typeof ENEMY_SWORDSMEN
  | typeof ENEMY_GOLEMS
  | typeof ENEMY_HEROES;

// =============================================================================
// GRAY ENEMY DEFINITIONS
// =============================================================================

export const GRAY_ENEMIES: Record<GrayEnemyId, EnemyDefinition> = {
  [ENEMY_CROSSBOWMEN]: {
    id: ENEMY_CROSSBOWMEN,
    name: "Crossbowmen",
    color: ENEMY_COLOR_GRAY,
    attack: 4,
    attackElement: ELEMENT_PHYSICAL,
    armor: 4,
    fame: 3,
    resistances: [],
    abilities: [ABILITY_SWIFT],
  },
  [ENEMY_GUARDSMEN]: {
    id: ENEMY_GUARDSMEN,
    name: "Guardsmen",
    color: ENEMY_COLOR_GRAY,
    attack: 3,
    attackElement: ELEMENT_PHYSICAL,
    armor: 7,
    fame: 3,
    resistances: [],
    abilities: [ABILITY_FORTIFIED],
  },
  [ENEMY_SWORDSMEN]: {
    id: ENEMY_SWORDSMEN,
    name: "Swordsmen",
    color: ENEMY_COLOR_GRAY,
    attack: 6,
    attackElement: ELEMENT_PHYSICAL,
    armor: 5,
    fame: 4,
    resistances: [],
    abilities: [],
  },
  [ENEMY_GOLEMS]: {
    id: ENEMY_GOLEMS,
    name: "Golems",
    color: ENEMY_COLOR_GRAY,
    attack: 2,
    attackElement: ELEMENT_PHYSICAL,
    armor: 5,
    fame: 4,
    resistances: [RESIST_PHYSICAL],
    abilities: [],
  },
  [ENEMY_HEROES]: {
    id: ENEMY_HEROES,
    name: "Heroes",
    color: ENEMY_COLOR_GRAY,
    attack: 5,
    attackElement: ELEMENT_PHYSICAL,
    armor: 4,
    fame: 5,
    resistances: [],
    abilities: [ABILITY_FORTIFIED],
    attacks: [
      { damage: 5, element: ELEMENT_PHYSICAL },
      { damage: 3, element: ELEMENT_PHYSICAL },
    ],
    reputationPenalty: 1,
  },
};

// =============================================================================
// TEST ALIASES (backward-compatible for tests)
// =============================================================================

/**
 * @deprecated Use ENEMY_GUARDSMEN directly
 */
export const ENEMY_WOLF = ENEMY_GUARDSMEN;
