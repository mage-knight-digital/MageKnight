/**
 * Unit ID constants for Mage Knight
 */

// =============================================================================
// REGULAR UNIT IDS
// =============================================================================
export const UNIT_PEASANTS = "peasants" as const;
export const UNIT_FORESTERS = "foresters" as const;
export const UNIT_HERBALIST = "herbalist" as const;
export const UNIT_SCOUTS = "scouts" as const;
export const UNIT_THUGS = "thugs" as const;
export const UNIT_UTEM_CROSSBOWMEN = "utem_crossbowmen" as const;
export const UNIT_UTEM_GUARDSMEN = "utem_guardsmen" as const;
export const UNIT_UTEM_SWORDSMEN = "utem_swordsmen" as const;
export const UNIT_GUARDIAN_GOLEMS = "guardian_golems" as const;
export const UNIT_ILLUSIONISTS = "illusionists" as const;
export const UNIT_SHOCKTROOPS = "shocktroops" as const;
export const UNIT_RED_CAPE_MONKS = "red_cape_monks" as const;
export const UNIT_NORTHERN_MONKS = "northern_monks" as const;
export const UNIT_SAVAGE_MONKS = "savage_monks" as const;
export const UNIT_MAGIC_FAMILIARS = "magic_familiars" as const;

// =============================================================================
// ELITE UNIT IDS
// =============================================================================
export const UNIT_FIRE_MAGES = "fire_mages" as const;
export const UNIT_ICE_MAGES = "ice_mages" as const;
export const UNIT_FIRE_GOLEMS = "fire_golems" as const;
export const UNIT_ICE_GOLEMS = "ice_golems" as const;
export const UNIT_SORCERERS = "sorcerers" as const;
export const UNIT_CATAPULTS = "catapults" as const;
export const UNIT_AMOTEP_GUNNERS = "amotep_gunners" as const;
export const UNIT_AMOTEP_FREEZERS = "amotep_freezers" as const;
export const UNIT_HEROES = "heroes" as const;
export const UNIT_HERO_BLUE = "hero_blue" as const;
export const UNIT_ALTEM_MAGES = "altem_mages" as const;
export const UNIT_ALTEM_GUARDIANS = "altem_guardians" as const;
export const UNIT_DELPHANA_MASTERS = "delphana_masters" as const;

// =============================================================================
// UNIT ID TYPE
// =============================================================================
export type UnitId =
  // Regular units
  | typeof UNIT_PEASANTS
  | typeof UNIT_FORESTERS
  | typeof UNIT_HERBALIST
  | typeof UNIT_SCOUTS
  | typeof UNIT_THUGS
  | typeof UNIT_UTEM_CROSSBOWMEN
  | typeof UNIT_UTEM_GUARDSMEN
  | typeof UNIT_UTEM_SWORDSMEN
  | typeof UNIT_GUARDIAN_GOLEMS
  | typeof UNIT_ILLUSIONISTS
  | typeof UNIT_SHOCKTROOPS
  | typeof UNIT_RED_CAPE_MONKS
  | typeof UNIT_NORTHERN_MONKS
  | typeof UNIT_SAVAGE_MONKS
  | typeof UNIT_MAGIC_FAMILIARS
  // Elite units
  | typeof UNIT_FIRE_MAGES
  | typeof UNIT_ICE_MAGES
  | typeof UNIT_FIRE_GOLEMS
  | typeof UNIT_ICE_GOLEMS
  | typeof UNIT_SORCERERS
  | typeof UNIT_CATAPULTS
  | typeof UNIT_AMOTEP_GUNNERS
  | typeof UNIT_AMOTEP_FREEZERS
  | typeof UNIT_HEROES
  | typeof UNIT_HERO_BLUE
  | typeof UNIT_ALTEM_MAGES
  | typeof UNIT_ALTEM_GUARDIANS
  | typeof UNIT_DELPHANA_MASTERS;

/**
 * Unit IDs that count as "Heroes" for recruitment (Heroes/Thugs exclusion
 * and doubled reputation modifier). Includes UNIT_HEROES and each specific
 * Hero unit type (Blue, etc.) as they are added.
 */
export const HERO_UNIT_IDS: readonly UnitId[] = [
  UNIT_HEROES,
  UNIT_HERO_BLUE,
] as const;

/** Returns true if the unit ID is a Hero unit (for special rules). */
export function isHeroUnitId(id: UnitId): boolean {
  return (HERO_UNIT_IDS as readonly UnitId[]).includes(id);
}
