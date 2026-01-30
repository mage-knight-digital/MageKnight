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
  ABILITY_CUMBERSOME,
  ABILITY_ASSASSINATION,
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
export type { GreenEnemyId } from "./green.js";
export {
  ENEMY_DIGGERS,
  ENEMY_PROWLERS,
  ENEMY_CURSED_HAGS,
  ENEMY_WOLF_RIDERS,
  ENEMY_IRONCLADS,
  ENEMY_ORC_SUMMONERS,
  ENEMY_CENTAUR_OUTRIDERS,
  GREEN_ENEMIES,
  ENEMY_ORC, // Test alias
} from "./green.js";

// Gray (Keep garrison)
export type { GrayEnemyId } from "./gray.js";
export {
  ENEMY_CROSSBOWMEN,
  ENEMY_GUARDSMEN,
  ENEMY_SWORDSMEN,
  ENEMY_GOLEMS,
  GRAY_ENEMIES,
  ENEMY_WOLF, // Test alias
} from "./gray.js";

// Brown (Dungeon monsters)
export type { BrownEnemyId } from "./brown.js";
export {
  ENEMY_MINOTAUR,
  ENEMY_GARGOYLE,
  ENEMY_MEDUSA,
  ENEMY_CRYPT_WORM,
  ENEMY_WEREWOLF,
  ENEMY_SHADOW,
  BROWN_ENEMIES,
} from "./brown.js";

// Violet (Mage Tower)
export type { VioletEnemyId } from "./violet.js";
export {
  ENEMY_MONKS,
  ENEMY_ILLUSIONISTS,
  ENEMY_ICE_MAGES,
  ENEMY_FIRE_MAGES,
  ENEMY_ICE_GOLEMS,
  ENEMY_SORCERERS,
  VIOLET_ENEMIES,
  ENEMY_FIRE_MAGE, // Test alias
  ENEMY_ICE_GOLEM, // Test alias
} from "./violet.js";

// White (City garrison)
export type { WhiteEnemyId } from "./white.js";
export {
  ENEMY_THUGS,
  ENEMY_SHOCKTROOPS,
  ENEMY_FREEZERS,
  ENEMY_ALTEM_GUARDSMEN,
  ENEMY_ALTEM_MAGES,
  ENEMY_DELPHANA_MASTERS,
  WHITE_ENEMIES,
} from "./white.js";

// Red (Draconum)
export type { RedEnemyId } from "./red.js";
export {
  ENEMY_SWAMP_DRAGON,
  ENEMY_FIRE_DRAGON,
  ENEMY_ICE_DRAGON,
  ENEMY_HIGH_DRAGON,
  ENEMY_DEATH_DRAGON,
  RED_ENEMIES,
} from "./red.js";

// =============================================================================
// AGGREGATE ENEMIES RECORD
// =============================================================================

import type { EnemyId, EnemyDefinition, EnemyColor } from "./types.js";
import { GREEN_ENEMIES } from "./green.js";
import { GRAY_ENEMIES } from "./gray.js";
import { BROWN_ENEMIES } from "./brown.js";
import { VIOLET_ENEMIES } from "./violet.js";
import { WHITE_ENEMIES } from "./white.js";
import { RED_ENEMIES } from "./red.js";

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
