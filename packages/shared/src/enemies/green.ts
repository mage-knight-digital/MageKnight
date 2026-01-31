/**
 * Green Enemy Definitions - Marauding Orcs
 *
 * Green enemies are roaming orc bands found in the countryside.
 * They range from fame 2-4 and are generally the weakest enemies.
 * Diggers are fortified, Wolf Riders are swift, and Orc Summoners
 * can call brown dungeon enemies into battle.
 *
 * @module enemies/green
 *
 * @remarks Enemies in this module:
 * - Diggers - Fortified miners with low armor
 * - Prowlers - Basic orc scouts
 * - Cursed Hags - Poison-wielding witches
 * - Wolf Riders - Swift cavalry
 * - Ironclads - Physically resistant brutes
 * - Orc Summoners - Summon brown dungeon enemies
 * - Centaur Outriders - Swift Elementalist cavalry
 * - Orc Skirmishers - Multiple attacks (1, 1)
 * - Orc War Beasts - Brutal beasts with fire/ice resistance
 * - Skeletal Warriors - Fire-resistant Dark Crusaders
 */

import { ELEMENT_PHYSICAL } from "../elements.js";
import {
  ENEMY_COLOR_GREEN,
  FACTION_DARK_CRUSADERS,
  FACTION_ELEMENTALIST,
  type EnemyDefinition,
} from "./types.js";
import {
  ABILITY_FORTIFIED,
  ABILITY_POISON,
  ABILITY_SWIFT,
  ABILITY_BRUTAL,
  ABILITY_SUMMON,
  ABILITY_UNFORTIFIED,
} from "./abilities.js";
import { RESIST_PHYSICAL, RESIST_FIRE, RESIST_ICE } from "./resistances.js";

// =============================================================================
// GREEN ENEMY ID CONSTANTS
// =============================================================================

export const ENEMY_DIGGERS = "diggers" as const;
export const ENEMY_PROWLERS = "prowlers" as const;
export const ENEMY_CURSED_HAGS = "cursed_hags" as const;
export const ENEMY_WOLF_RIDERS = "wolf_riders" as const;
export const ENEMY_IRONCLADS = "ironclads" as const;
export const ENEMY_ORC_SUMMONERS = "orc_summoners" as const;
export const ENEMY_CENTAUR_OUTRIDERS = "centaur_outriders" as const;
export const ENEMY_ORC_SKIRMISHERS = "orc_skirmishers" as const;
export const ENEMY_ORC_WAR_BEASTS = "orc_war_beasts" as const;
export const ENEMY_SKELETAL_WARRIORS = "skeletal_warriors" as const;

/**
 * Union type of all green (Marauding Orc) enemy IDs
 */
export type GreenEnemyId =
  | typeof ENEMY_DIGGERS
  | typeof ENEMY_PROWLERS
  | typeof ENEMY_CURSED_HAGS
  | typeof ENEMY_WOLF_RIDERS
  | typeof ENEMY_IRONCLADS
  | typeof ENEMY_ORC_SUMMONERS
  | typeof ENEMY_CENTAUR_OUTRIDERS
  | typeof ENEMY_ORC_SKIRMISHERS
  | typeof ENEMY_ORC_WAR_BEASTS
  | typeof ENEMY_SKELETAL_WARRIORS;

// =============================================================================
// GREEN ENEMY DEFINITIONS
// =============================================================================

export const GREEN_ENEMIES: Record<GreenEnemyId, EnemyDefinition> = {
  [ENEMY_DIGGERS]: {
    id: ENEMY_DIGGERS,
    name: "Diggers",
    color: ENEMY_COLOR_GREEN,
    attack: 3,
    attackElement: ELEMENT_PHYSICAL,
    armor: 3,
    fame: 2,
    resistances: [],
    abilities: [ABILITY_FORTIFIED],
  },
  [ENEMY_PROWLERS]: {
    id: ENEMY_PROWLERS,
    name: "Prowlers",
    color: ENEMY_COLOR_GREEN,
    attack: 4,
    attackElement: ELEMENT_PHYSICAL,
    armor: 3,
    fame: 2,
    resistances: [],
    abilities: [],
  },
  [ENEMY_CURSED_HAGS]: {
    id: ENEMY_CURSED_HAGS,
    name: "Cursed Hags",
    color: ENEMY_COLOR_GREEN,
    attack: 3,
    attackElement: ELEMENT_PHYSICAL,
    armor: 5,
    fame: 3,
    resistances: [],
    abilities: [ABILITY_POISON],
  },
  [ENEMY_WOLF_RIDERS]: {
    id: ENEMY_WOLF_RIDERS,
    name: "Wolf Riders",
    color: ENEMY_COLOR_GREEN,
    attack: 3,
    attackElement: ELEMENT_PHYSICAL,
    armor: 4,
    fame: 3,
    resistances: [],
    abilities: [ABILITY_SWIFT],
  },
  [ENEMY_IRONCLADS]: {
    id: ENEMY_IRONCLADS,
    name: "Ironclads",
    color: ENEMY_COLOR_GREEN,
    attack: 4,
    attackElement: ELEMENT_PHYSICAL,
    armor: 3,
    fame: 4,
    resistances: [RESIST_PHYSICAL],
    abilities: [ABILITY_BRUTAL],
  },
  [ENEMY_ORC_SUMMONERS]: {
    id: ENEMY_ORC_SUMMONERS,
    name: "Orc Summoners",
    color: ENEMY_COLOR_GREEN,
    attack: 0, // Summoners don't attack directly
    attackElement: ELEMENT_PHYSICAL,
    armor: 4,
    fame: 4,
    resistances: [],
    abilities: [ABILITY_SUMMON], // Summons brown enemy
  },
  [ENEMY_CENTAUR_OUTRIDERS]: {
    id: ENEMY_CENTAUR_OUTRIDERS,
    name: "Centaur Outriders",
    color: ENEMY_COLOR_GREEN,
    attack: 3,
    attackElement: ELEMENT_PHYSICAL,
    armor: 5,
    fame: 2,
    resistances: [],
    abilities: [ABILITY_SWIFT],
    faction: FACTION_ELEMENTALIST,
  },
  [ENEMY_ORC_SKIRMISHERS]: {
    id: ENEMY_ORC_SKIRMISHERS,
    name: "Orc Skirmishers",
    color: ENEMY_COLOR_GREEN,
    attack: 0, // Multiple attacks - use attacks array
    attackElement: ELEMENT_PHYSICAL,
    armor: 4,
    fame: 2,
    resistances: [],
    abilities: [],
    attacks: [
      { damage: 1, element: ELEMENT_PHYSICAL },
      { damage: 1, element: ELEMENT_PHYSICAL },
    ],
  },
  [ENEMY_ORC_WAR_BEASTS]: {
    id: ENEMY_ORC_WAR_BEASTS,
    name: "Orc War Beasts",
    color: ENEMY_COLOR_GREEN,
    attack: 3,
    attackElement: ELEMENT_PHYSICAL,
    armor: 5,
    fame: 3,
    resistances: [RESIST_FIRE, RESIST_ICE],
    abilities: [ABILITY_UNFORTIFIED, ABILITY_BRUTAL],
  },
  [ENEMY_SKELETAL_WARRIORS]: {
    id: ENEMY_SKELETAL_WARRIORS,
    name: "Skeletal Warriors",
    color: ENEMY_COLOR_GREEN,
    attack: 3,
    attackElement: ELEMENT_PHYSICAL,
    armor: 4,
    fame: 1,
    resistances: [RESIST_FIRE],
    abilities: [],
    faction: FACTION_DARK_CRUSADERS,
  },
};

// =============================================================================
// TEST ALIASES (backward-compatible for tests)
// =============================================================================

/**
 * @deprecated Use ENEMY_DIGGERS directly
 */
export const ENEMY_ORC = ENEMY_DIGGERS;
