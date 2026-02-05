/**
 * Enemy Definitions for Mage Knight
 *
 * This module provides a modular, category-based organization of all
 * enemy definitions. Enemies are organized by their token back color,
 * which indicates where they appear on the map.
 *
 * @module enemies
 *
 * @remarks
 * Token colors and locations:
 * - Green: Marauding Orcs - roaming enemies on countryside
 * - Gray: Keep Garrison - defend keeps
 * - Brown: Dungeon Monsters - in dungeons/tombs
 * - Violet: Mage Tower - defend mage towers
 * - White: City Garrison - defend cities
 * - Red: Draconum - powerful dragons
 *
 * Data extracted from Mage Knight Plus TTS mod
 * https://steamcommunity.com/sharedfiles/filedetails/?id=2127352568
 *
 * @example
 * ```typescript
 * import { ENEMIES, getEnemy, ENEMY_DIGGERS } from '@mage-knight/shared';
 *
 * // Get a specific enemy
 * const diggers = getEnemy(ENEMY_DIGGERS);
 * console.log(diggers.name); // "Diggers"
 *
 * // Get all enemies of a color
 * const orcs = getEnemiesByColor(ENEMY_COLOR_GREEN);
 * ```
 */

// =============================================================================
// RE-EXPORT TYPES
// =============================================================================

export type {
  EnemyResistances,
  EnemyDefinition,
  EnemyColor,
  EnemyId,
  Faction,
  EnemyAttack,
} from "./types.js";

export {
  ENEMY_COLOR_GREEN,
  ENEMY_COLOR_GRAY,
  ENEMY_COLOR_BROWN,
  ENEMY_COLOR_VIOLET,
  ENEMY_COLOR_RED,
  ENEMY_COLOR_WHITE,
  FACTION_ELEMENTALIST,
  FACTION_DARK_CRUSADERS,
} from "./types.js";

// =============================================================================
// RE-EXPORT ABILITIES
// =============================================================================

export type { EnemyAbilityType, AbilityDescription } from "./abilities.js";

export {
  ABILITY_FORTIFIED,
  ABILITY_UNFORTIFIED,
  ABILITY_SWIFT,
  ABILITY_BRUTAL,
  ABILITY_POISON,
  ABILITY_PARALYZE,
  ABILITY_SUMMON,
  ABILITY_SUMMON_GREEN,
  ABILITY_CUMBERSOME,
  ABILITY_ASSASSINATION,
  ABILITY_ARCANE_IMMUNITY,
  ABILITY_ELUSIVE,
  ABILITY_VAMPIRIC,
  ABILITY_COLD_FIRE_ATTACK,
  ABILITY_ICE_ATTACK,
  ABILITY_FIRE_ATTACK,
  ABILITY_DEFEND,
  ABILITY_DESCRIPTIONS,
} from "./abilities.js";

// =============================================================================
// RE-EXPORT RESISTANCES
// =============================================================================

export {
  RESIST_PHYSICAL,
  RESIST_FIRE,
  RESIST_ICE,
  RESISTANCE_DESCRIPTIONS,
} from "./resistances.js";
export type { ResistanceType, ResistanceDescription } from "./resistances.js";

// =============================================================================
// RE-EXPORT ELEMENTS (for convenience, as original file did)
// =============================================================================

export {
  ELEMENT_PHYSICAL,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_COLD_FIRE,
} from "../elements.js";
export type { Element } from "../elements.js";

// =============================================================================
// RE-EXPORT FACTION ENEMY IDs AND TYPES
// =============================================================================

// Green (Marauding Orcs)
export type { GreenEnemyId } from "./green/index.js";
export {
  ENEMY_DIGGERS,
  ENEMY_PROWLERS,
  ENEMY_CURSED_HAGS,
  ENEMY_WOLF_RIDERS,
  ENEMY_IRONCLADS,
  ENEMY_ORC_SUMMONERS,
  ENEMY_CENTAUR_OUTRIDERS,
  ENEMY_ORC_SKIRMISHERS,
  ENEMY_ORC_WAR_BEASTS,
  ENEMY_ORC_STONETHROWERS,
  ENEMY_ORC_TRACKER,
  ENEMY_SKELETAL_WARRIORS,
  ENEMY_SHROUDED_NECROMANCERS,
  ENEMY_CORRUPTED_PRIESTS,
  ENEMY_GIBBERING_GHOULS,
  ENEMY_ELEMENTAL_PRIESTS,
  ENEMY_ELVEN_PROTECTORS,
  GREEN_ENEMIES,
  ENEMY_CRYSTAL_SPRITES,
  ENEMY_ORC, // Test alias
} from "./green/index.js";

// Gray (Keep garrison)
export type { GrayEnemyId } from "./gray/index.js";
export {
  ENEMY_CROSSBOWMEN,
  ENEMY_GUARDSMEN,
  ENEMY_SWORDSMEN,
  ENEMY_GOLEMS,
  ENEMY_HEROES,
  ENEMY_THUGS_GRAY,
  GRAY_ENEMIES,
  ENEMY_WOLF, // Test alias
} from "./gray/index.js";

// Brown (Dungeon monsters)
export type { BrownEnemyId } from "./brown/index.js";
export {
  ENEMY_MINOTAUR,
  ENEMY_GARGOYLE,
  ENEMY_MEDUSA,
  ENEMY_CRYPT_WORM,
  ENEMY_WEREWOLF,
  ENEMY_SHADOW,
  ENEMY_FIRE_ELEMENTAL,
  ENEMY_EARTH_ELEMENTAL,
  ENEMY_MUMMY,
  ENEMY_HYDRA,
  ENEMY_MANTICORE,
  ENEMY_WATER_ELEMENTAL,
  ENEMY_VAMPIRE,
  BROWN_ENEMIES,
} from "./brown/index.js";

// Violet (Mage Tower)
export type { VioletEnemyId } from "./violet/index.js";
export {
  ENEMY_MONKS,
  ENEMY_ILLUSIONISTS,
  ENEMY_ICE_MAGES,
  ENEMY_FIRE_MAGES,
  ENEMY_ICE_GOLEMS,
  ENEMY_FIRE_GOLEMS,
  ENEMY_SORCERERS,
  ENEMY_MAGIC_FAMILIARS,
  VIOLET_ENEMIES,
  ENEMY_FIRE_MAGE, // Test alias
  ENEMY_ICE_GOLEM, // Test alias
  ENEMY_FIRE_GOLEM, // Test alias
} from "./violet/index.js";

// White (City garrison)
export type { WhiteEnemyId } from "./white/index.js";
export {
  ENEMY_THUGS,
  ENEMY_SHOCKTROOPS,
  ENEMY_FREEZERS,
  ENEMY_GUNNERS,
  ENEMY_FIRE_CATAPULT,
  ENEMY_ICE_CATAPULT,
  ENEMY_ALTEM_GUARDSMEN,
  ENEMY_ALTEM_MAGES,
  ENEMY_DELPHANA_MASTERS,
  ENEMY_GRIM_LEGIONNARIES,
  WHITE_ENEMIES,
} from "./white/index.js";

// Red (Draconum)
export type { RedEnemyId } from "./red/index.js";
export {
  ENEMY_SWAMP_DRAGON,
  ENEMY_FIRE_DRAGON,
  ENEMY_ICE_DRAGON,
  ENEMY_HIGH_DRAGON,
  ENEMY_DEATH_DRAGON,
  ENEMY_LAVA_DRAGON,
  ENEMY_SAVAGE_DRAGON,
  ENEMY_DRAGON_SUMMONER,
  ENEMY_LIGHTNING_DRAGON,
  RED_ENEMIES,
} from "./red/index.js";

// =============================================================================
// AGGREGATE ENEMIES RECORD
// =============================================================================

import type { EnemyId, EnemyDefinition, EnemyColor } from "./types.js";
import { GREEN_ENEMIES } from "./green/index.js";
import { GRAY_ENEMIES } from "./gray/index.js";
import { BROWN_ENEMIES } from "./brown/index.js";
import { VIOLET_ENEMIES } from "./violet/index.js";
import { WHITE_ENEMIES } from "./white/index.js";
import { RED_ENEMIES } from "./red/index.js";

/**
 * Complete record of all enemy definitions indexed by EnemyId
 */
export const ENEMIES: Record<EnemyId, EnemyDefinition> = {
  ...GREEN_ENEMIES,
  ...GRAY_ENEMIES,
  ...BROWN_ENEMIES,
  ...VIOLET_ENEMIES,
  ...WHITE_ENEMIES,
  ...RED_ENEMIES,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get an enemy definition by ID
 */
export function getEnemy(id: EnemyId): EnemyDefinition {
  return ENEMIES[id];
}

/**
 * Get all enemies of a specific color
 */
export function getEnemiesByColor(color: EnemyColor): EnemyDefinition[] {
  return Object.values(ENEMIES).filter((e) => e.color === color);
}
