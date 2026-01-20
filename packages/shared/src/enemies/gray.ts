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
 * - Crossbowmen - Ranged defenders
 * - Guardsmen - Fortified melee guards
 * - Swordsmen - Heavy infantry
 * - Golems - Physically resistant constructs
 */

import { ELEMENT_PHYSICAL } from "../elements.js";
import { ENEMY_COLOR_GRAY, type EnemyDefinition } from "./types.js";
import { ABILITY_FORTIFIED } from "./abilities.js";
import { NO_RESISTANCES, PHYSICAL_RESISTANCE } from "./resistances.js";

// =============================================================================
// GRAY ENEMY ID CONSTANTS
// =============================================================================

export const ENEMY_CROSSBOWMEN = "crossbowmen" as const;
export const ENEMY_GUARDSMEN = "guardsmen" as const;
export const ENEMY_SWORDSMEN = "swordsmen" as const;
export const ENEMY_GOLEMS = "golems" as const;

/**
 * Union type of all gray (Keep garrison) enemy IDs
 */
export type GrayEnemyId =
  | typeof ENEMY_CROSSBOWMEN
  | typeof ENEMY_GUARDSMEN
  | typeof ENEMY_SWORDSMEN
  | typeof ENEMY_GOLEMS;

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
    armor: 3,
    fame: 3,
    resistances: NO_RESISTANCES,
    abilities: [],
  },
  [ENEMY_GUARDSMEN]: {
    id: ENEMY_GUARDSMEN,
    name: "Guardsmen",
    color: ENEMY_COLOR_GRAY,
    attack: 3,
    attackElement: ELEMENT_PHYSICAL,
    armor: 7,
    fame: 3,
    resistances: NO_RESISTANCES,
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
    resistances: NO_RESISTANCES,
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
    resistances: PHYSICAL_RESISTANCE,
    abilities: [],
  },
};

// =============================================================================
// TEST ALIASES (backward-compatible for tests)
// =============================================================================

/**
 * @deprecated Use ENEMY_GUARDSMEN directly
 */
export const ENEMY_WOLF = ENEMY_GUARDSMEN;
