/**
 * White Enemy Definitions - City Garrison
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
import { RESIST_PHYSICAL, RESIST_FIRE, RESIST_ICE } from "./resistances.js";

export const ENEMY_THUGS = "thugs" as const;
export const ENEMY_SHOCKTROOPS = "shocktroops" as const;
export const ENEMY_ICE_GOLEMS = "ice_golems" as const;
export const ENEMY_FREEZERS = "freezers" as const;
export const ENEMY_ALTEM_GUARDSMEN = "altem_guardsmen" as const;
export const ENEMY_ALTEM_MAGES = "altem_mages" as const;

export type WhiteEnemyId =
  | typeof ENEMY_THUGS
  | typeof ENEMY_SHOCKTROOPS
  | typeof ENEMY_ICE_GOLEMS
  | typeof ENEMY_FREEZERS
  | typeof ENEMY_ALTEM_GUARDSMEN
  | typeof ENEMY_ALTEM_MAGES;

export const WHITE_ENEMIES: Record<WhiteEnemyId, EnemyDefinition> = {
  [ENEMY_THUGS]: {
    id: ENEMY_THUGS,
    name: "Thugs",
    color: ENEMY_COLOR_WHITE,
    attack: 6,
    attackElement: ELEMENT_PHYSICAL,
    armor: 5,
    fame: 5,
    resistances: [],
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
    resistances: [],
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
    resistances: [RESIST_PHYSICAL],
    abilities: [ABILITY_PARALYZE],
  },
  [ENEMY_FREEZERS]: {
    id: ENEMY_FREEZERS,
    name: "Freezers",
    color: ENEMY_COLOR_WHITE,
    attack: 3,
    attackElement: ELEMENT_ICE,
    armor: 7,
    fame: 7,
    resistances: [RESIST_FIRE],
    abilities: [ABILITY_PARALYZE, ABILITY_SWIFT],
  },
  [ENEMY_ALTEM_GUARDSMEN]: {
    id: ENEMY_ALTEM_GUARDSMEN,
    name: "Altem Guardsmen",
    color: ENEMY_COLOR_WHITE,
    attack: 5,
    attackElement: ELEMENT_PHYSICAL,
    armor: 7,
    fame: 8,
    resistances: [RESIST_PHYSICAL, RESIST_FIRE, RESIST_ICE],
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
    resistances: [RESIST_FIRE, RESIST_ICE],
    abilities: [ABILITY_BRUTAL],
  },
};

/** @deprecated Use ENEMY_ICE_GOLEMS directly */
export const ENEMY_ICE_GOLEM = ENEMY_ICE_GOLEMS;
