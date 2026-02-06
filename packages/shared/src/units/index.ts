/**
 * Unit Definitions for Mage Knight
 *
 * This module provides a modular, level-based organization of all
 * unit definitions. Units are organized by type (regular/elite)
 * and level (1-4).
 *
 * @module units
 *
 * @remarks
 * Unit types and levels:
 * - Regular units: Level 1 (basic) and Level 2 (improved)
 * - Elite units: Level 3 (advanced) and Level 4 (powerful)
 *
 * Data extracted from Mage Knight Plus TTS mod
 * https://steamcommunity.com/sharedfiles/filedetails/?id=2127352568
 *
 * @example
 * ```typescript
 * import { UNITS, getUnit, UNIT_PEASANTS, getUnitsByLevel } from '@mage-knight/shared';
 *
 * // Get a specific unit
 * const peasants = getUnit(UNIT_PEASANTS);
 * console.log(peasants.name); // "Peasants"
 *
 * // Get all level 2 units
 * const level2Units = getUnitsByLevel(2);
 * ```
 */

// =============================================================================
// RE-EXPORT TYPES
// =============================================================================

export type {
  UnitType,
  RecruitSite,
  UnitAbilityType,
  UnitResistances,
  UnitAbility,
  UnitTerrainModifier,
  UnitDefinition,
  RecruitmentSource,
} from "./types.js";

export {
  RECRUITMENT_SOURCE_NORMAL,
  RECRUITMENT_SOURCE_ARTIFACT,
  RECRUITMENT_SOURCE_SPELL,
} from "./types.js";

// =============================================================================
// RE-EXPORT CONSTANTS
// =============================================================================

export {
  UNIT_TYPE_REGULAR,
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_VILLAGE,
  RECRUIT_SITE_KEEP,
  RECRUIT_SITE_MAGE_TOWER,
  RECRUIT_SITE_MONASTERY,
  RECRUIT_SITE_CITY,
  RECRUIT_SITE_CAMP,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_RANGED_ATTACK,
  UNIT_ABILITY_SIEGE_ATTACK,
  UNIT_ABILITY_MOVE,
  UNIT_ABILITY_INFLUENCE,
  UNIT_ABILITY_HEAL,
  UNIT_ABILITY_SWIFT,
  UNIT_ABILITY_BRUTAL,
  UNIT_ABILITY_POISON,
  UNIT_ABILITY_PARALYZE,
  UNIT_ABILITY_EFFECT,
} from "./constants.js";

// =============================================================================
// RE-EXPORT UNIT IDS
// =============================================================================

export type { UnitId } from "./ids.js";
export { HERO_UNIT_IDS, isHeroUnitId } from "./ids.js";

// Regular unit IDs
export {
  UNIT_PEASANTS,
  UNIT_FORESTERS,
  UNIT_HERBALIST,
  UNIT_SCOUTS,
  UNIT_THUGS,
  UNIT_UTEM_CROSSBOWMEN,
  UNIT_UTEM_GUARDSMEN,
  UNIT_UTEM_SWORDSMEN,
  UNIT_GUARDIAN_GOLEMS,
  UNIT_ILLUSIONISTS,
  UNIT_SHOCKTROOPS,
  UNIT_RED_CAPE_MONKS,
  UNIT_NORTHERN_MONKS,
  UNIT_SAVAGE_MONKS,
  UNIT_MAGIC_FAMILIARS,
  // Elite unit IDs
  UNIT_FIRE_MAGES,
  UNIT_ICE_MAGES,
  UNIT_FIRE_GOLEMS,
  UNIT_ICE_GOLEMS,
  UNIT_SORCERERS,
  UNIT_CATAPULTS,
  UNIT_AMOTEP_GUNNERS,
  UNIT_AMOTEP_FREEZERS,
  UNIT_HEROES,
  UNIT_HERO_BLUE,
  UNIT_ALTEM_MAGES,
  UNIT_ALTEM_GUARDIANS,
  UNIT_DELPHANA_MASTERS,
} from "./ids.js";

// =============================================================================
// RE-EXPORT UNIT DEFINITION RECORDS
// =============================================================================

export { REGULAR_UNITS } from "./regular/index.js";
export { ELITE_UNITS } from "./elite/index.js";

// Re-export individual unit definitions for direct access
export * from "./regular/index.js";
export * from "./elite/index.js";

// =============================================================================
// AGGREGATE UNITS RECORD
// =============================================================================

import type { UnitId } from "./ids.js";
import type { UnitType, RecruitSite, UnitDefinition } from "./types.js";
import { UNIT_TYPE_REGULAR, UNIT_TYPE_ELITE } from "./constants.js";
import { REGULAR_UNITS } from "./regular/index.js";
import { ELITE_UNITS } from "./elite/index.js";

/**
 * Complete record of all unit definitions indexed by UnitId
 */
export const UNITS: Record<UnitId, UnitDefinition> = {
  ...REGULAR_UNITS,
  ...ELITE_UNITS,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get a unit definition by ID
 */
export function getUnit(id: UnitId): UnitDefinition {
  return UNITS[id];
}

/**
 * Get all units of a specific type (regular or elite)
 */
export function getUnitsByType(type: UnitType): UnitDefinition[] {
  return Object.values(UNITS).filter((u) => u.type === type);
}

/**
 * Get all regular units
 */
export function getRegularUnits(): UnitDefinition[] {
  return getUnitsByType(UNIT_TYPE_REGULAR);
}

/**
 * Get all elite units
 */
export function getEliteUnits(): UnitDefinition[] {
  return getUnitsByType(UNIT_TYPE_ELITE);
}

/**
 * Get all units of a specific level
 */
export function getUnitsByLevel(level: number): UnitDefinition[] {
  return Object.values(UNITS).filter((u) => u.level === level);
}

/**
 * Check if a unit can be recruited at a specific site
 */
export function canRecruitAt(unit: UnitDefinition, site: RecruitSite): boolean {
  return unit.recruitSites.includes(site);
}
