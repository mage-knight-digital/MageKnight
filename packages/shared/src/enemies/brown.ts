/**
 * Brown Enemy Definitions - Dungeon Monsters
 *
 * Brown enemies are found in dungeons and tombs. They are generally
 * stronger than surface enemies and often have special abilities.
 * Dungeons prevent unit participation and gold mana usage.
 *
 * @module enemies/brown
 *
 * @remarks Enemies in this module:
 * - Minotaur - High armor, brutal attack
 * - Gargoyle - Physical resistance
 * - Medusa - Paralyze ability
 * - Crypt Worm - Fortified, underground
 * - Werewolf - Swift predator
 * - Shadow - ColdFire attack, elusive
 * - Fire Elemental - Fire attack, fire resistance, Elementalist faction
 * - Mummy - Ice+physical resistance, poison
 * - Hydra - Multiple attacks (2, 2, 2), ice resistance
 * - Manticore - Swift, assassination, poison, fire resistance
 * - Water Elemental - Ice attack, ice resistance, Elementalist faction
 */

import { ELEMENT_PHYSICAL, ELEMENT_COLD_FIRE, ELEMENT_FIRE, ELEMENT_ICE } from "../elements.js";
import { ENEMY_COLOR_BROWN, FACTION_ELEMENTALIST, type EnemyDefinition } from "./types.js";
import {
  ABILITY_BRUTAL,
  ABILITY_PARALYZE,
  ABILITY_FORTIFIED,
  ABILITY_SWIFT,
  ABILITY_POISON,
  ABILITY_ASSASSINATION,
} from "./abilities.js";
import { RESIST_PHYSICAL, RESIST_FIRE, RESIST_ICE } from "./resistances.js";

// =============================================================================
// BROWN ENEMY ID CONSTANTS
// =============================================================================

export const ENEMY_MINOTAUR = "minotaur" as const;
export const ENEMY_GARGOYLE = "gargoyle" as const;
export const ENEMY_MEDUSA = "medusa" as const;
export const ENEMY_CRYPT_WORM = "crypt_worm" as const;
export const ENEMY_WEREWOLF = "werewolf" as const;
export const ENEMY_SHADOW = "shadow" as const;
export const ENEMY_FIRE_ELEMENTAL = "fire_elemental" as const;
export const ENEMY_MUMMY = "mummy" as const;
export const ENEMY_HYDRA = "hydra" as const;
export const ENEMY_MANTICORE = "manticore" as const;
export const ENEMY_WATER_ELEMENTAL = "water_elemental" as const;

/**
 * Union type of all brown (Dungeon monster) enemy IDs
 */
export type BrownEnemyId =
  | typeof ENEMY_MINOTAUR
  | typeof ENEMY_GARGOYLE
  | typeof ENEMY_MEDUSA
  | typeof ENEMY_CRYPT_WORM
  | typeof ENEMY_WEREWOLF
  | typeof ENEMY_SHADOW
  | typeof ENEMY_FIRE_ELEMENTAL
  | typeof ENEMY_MUMMY
  | typeof ENEMY_HYDRA
  | typeof ENEMY_MANTICORE
  | typeof ENEMY_WATER_ELEMENTAL;

// =============================================================================
// BROWN ENEMY DEFINITIONS
// =============================================================================

export const BROWN_ENEMIES: Record<BrownEnemyId, EnemyDefinition> = {
  [ENEMY_MINOTAUR]: {
    id: ENEMY_MINOTAUR,
    name: "Minotaur",
    color: ENEMY_COLOR_BROWN,
    attack: 5,
    attackElement: ELEMENT_PHYSICAL,
    armor: 5,
    fame: 4,
    resistances: [],
    abilities: [ABILITY_BRUTAL],
  },
  [ENEMY_GARGOYLE]: {
    id: ENEMY_GARGOYLE,
    name: "Gargoyle",
    color: ENEMY_COLOR_BROWN,
    attack: 5,
    attackElement: ELEMENT_PHYSICAL,
    armor: 4,
    fame: 4,
    resistances: [RESIST_PHYSICAL],
    abilities: [],
  },
  [ENEMY_MEDUSA]: {
    id: ENEMY_MEDUSA,
    name: "Medusa",
    color: ENEMY_COLOR_BROWN,
    attack: 6,
    attackElement: ELEMENT_PHYSICAL,
    armor: 4,
    fame: 5,
    resistances: [],
    abilities: [ABILITY_PARALYZE],
  },
  [ENEMY_CRYPT_WORM]: {
    id: ENEMY_CRYPT_WORM,
    name: "Crypt Worm",
    color: ENEMY_COLOR_BROWN,
    attack: 6,
    attackElement: ELEMENT_PHYSICAL,
    armor: 6,
    fame: 5,
    resistances: [],
    abilities: [ABILITY_FORTIFIED],
  },
  [ENEMY_WEREWOLF]: {
    id: ENEMY_WEREWOLF,
    name: "Werewolf",
    color: ENEMY_COLOR_BROWN,
    attack: 7,
    attackElement: ELEMENT_PHYSICAL,
    armor: 5,
    fame: 5,
    resistances: [],
    abilities: [ABILITY_SWIFT],
  },
  [ENEMY_SHADOW]: {
    id: ENEMY_SHADOW,
    name: "Shadow",
    color: ENEMY_COLOR_BROWN,
    attack: 4,
    attackElement: ELEMENT_COLD_FIRE,
    armor: 4,
    fame: 4,
    resistances: [],
    abilities: [], // Elusive, arcane immunity not modeled yet
  },
  [ENEMY_FIRE_ELEMENTAL]: {
    id: ENEMY_FIRE_ELEMENTAL,
    name: "Fire Elemental",
    color: ENEMY_COLOR_BROWN,
    attack: 7,
    attackElement: ELEMENT_FIRE,
    armor: 6,
    fame: 4,
    resistances: [RESIST_FIRE],
    abilities: [],
    faction: FACTION_ELEMENTALIST,
  },
  [ENEMY_MUMMY]: {
    id: ENEMY_MUMMY,
    name: "Mummy",
    color: ENEMY_COLOR_BROWN,
    attack: 4,
    attackElement: ELEMENT_PHYSICAL,
    armor: 5,
    fame: 4,
    resistances: [RESIST_ICE, RESIST_PHYSICAL],
    abilities: [ABILITY_POISON],
  },
  [ENEMY_HYDRA]: {
    id: ENEMY_HYDRA,
    name: "Hydra",
    color: ENEMY_COLOR_BROWN,
    attack: 2,
    attackElement: ELEMENT_PHYSICAL,
    armor: 6,
    fame: 5,
    resistances: [RESIST_ICE],
    abilities: [],
    attacks: [
      { damage: 2, element: ELEMENT_PHYSICAL },
      { damage: 2, element: ELEMENT_PHYSICAL },
      { damage: 2, element: ELEMENT_PHYSICAL },
    ],
  },
  [ENEMY_MANTICORE]: {
    id: ENEMY_MANTICORE,
    name: "Manticore",
    color: ENEMY_COLOR_BROWN,
    attack: 4,
    attackElement: ELEMENT_PHYSICAL,
    armor: 6,
    fame: 5,
    resistances: [RESIST_FIRE],
    abilities: [ABILITY_SWIFT, ABILITY_ASSASSINATION, ABILITY_POISON],
  },
  [ENEMY_WATER_ELEMENTAL]: {
    id: ENEMY_WATER_ELEMENTAL,
    name: "Water Elemental",
    color: ENEMY_COLOR_BROWN,
    attack: 6,
    attackElement: ELEMENT_ICE,
    armor: 7,
    fame: 4,
    resistances: [RESIST_ICE],
    abilities: [],
    faction: FACTION_ELEMENTALIST,
  },
};
