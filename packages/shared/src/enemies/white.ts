/**
 * White Enemy Definitions - City Garrison
 *
 * White enemies defend cities and are among the strongest non-dragon
 * enemies. Fame ranges from 4-9. They include the powerful Altem forces.
 *
 * @module enemies/white
 *
 * @remarks Enemies in this module:
 * - Thugs - Basic city guards
 * - Shocktroops - Swift and brutal elite soldiers
 * - Freezers - ColdFire attack, paralyze
 * - Gunners - Fire attack, brutal
 * - Altem Guardsmen - Elite fortified guards
 * - Altem Mages - Powerful mages with ColdFire attack
 * - Delphana Masters - Elite assassins with ColdFire attack
 */

import { ELEMENT_PHYSICAL, ELEMENT_FIRE, ELEMENT_ICE, ELEMENT_COLD_FIRE } from "../elements.js";
import { ENEMY_COLOR_WHITE, type EnemyDefinition } from "./types.js";
import {
  ABILITY_SWIFT,
  ABILITY_BRUTAL,
  ABILITY_PARALYZE,
  ABILITY_FORTIFIED,
  ABILITY_ASSASSINATION,
  ABILITY_POISON,
} from "./abilities.js";
import { RESIST_PHYSICAL, RESIST_FIRE, RESIST_ICE } from "./resistances.js";

export const ENEMY_THUGS = "thugs" as const;
export const ENEMY_SHOCKTROOPS = "shocktroops" as const;
export const ENEMY_FREEZERS = "freezers" as const;
export const ENEMY_GUNNERS = "gunners" as const;
export const ENEMY_ALTEM_GUARDSMEN = "altem_guardsmen" as const;
export const ENEMY_ALTEM_MAGES = "altem_mages" as const;
export const ENEMY_DELPHANA_MASTERS = "delphana_masters" as const;

export type WhiteEnemyId =
  | typeof ENEMY_THUGS
  | typeof ENEMY_SHOCKTROOPS
  | typeof ENEMY_FREEZERS
  | typeof ENEMY_GUNNERS
  | typeof ENEMY_ALTEM_GUARDSMEN
  | typeof ENEMY_ALTEM_MAGES
  | typeof ENEMY_DELPHANA_MASTERS;

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
  [ENEMY_GUNNERS]: {
    id: ENEMY_GUNNERS,
    name: "Gunners",
    color: ENEMY_COLOR_WHITE,
    attack: 6,
    attackElement: ELEMENT_FIRE,
    armor: 6,
    fame: 7,
    resistances: [RESIST_ICE],
    abilities: [ABILITY_BRUTAL],
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
    attack: 4,
    attackElement: ELEMENT_COLD_FIRE,
    armor: 8,
    fame: 8,
    resistances: [RESIST_PHYSICAL],
    abilities: [ABILITY_BRUTAL, ABILITY_POISON],
  },
  [ENEMY_DELPHANA_MASTERS]: {
    id: ENEMY_DELPHANA_MASTERS,
    name: "Delphana Masters",
    color: ENEMY_COLOR_WHITE,
    attack: 5,
    attackElement: ELEMENT_COLD_FIRE,
    armor: 8,
    fame: 9,
    resistances: [RESIST_FIRE, RESIST_ICE],
    abilities: [ABILITY_ASSASSINATION, ABILITY_PARALYZE],
  },
};
