/**
 * Unit definitions for Mage Knight
 *
 * Data extracted from Mage Knight Plus TTS mod
 * https://steamcommunity.com/sharedfiles/filedetails/?id=2127352568
 */

import {
  ELEMENT_PHYSICAL,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  type Element,
} from "./elements.js";

// =============================================================================
// UNIT TYPE CONSTANTS
// =============================================================================
export const UNIT_TYPE_REGULAR = "regular" as const;
export const UNIT_TYPE_ELITE = "elite" as const;

export type UnitType = typeof UNIT_TYPE_REGULAR | typeof UNIT_TYPE_ELITE;

// =============================================================================
// RECRUITMENT SITE CONSTANTS
// =============================================================================
export const RECRUIT_SITE_VILLAGE = "village" as const;
export const RECRUIT_SITE_KEEP = "keep" as const;
export const RECRUIT_SITE_MAGE_TOWER = "mage_tower" as const;
export const RECRUIT_SITE_MONASTERY = "monastery" as const;
export const RECRUIT_SITE_CITY = "city" as const;
export const RECRUIT_SITE_CAMP = "camp" as const;

export type RecruitSite =
  | typeof RECRUIT_SITE_VILLAGE
  | typeof RECRUIT_SITE_KEEP
  | typeof RECRUIT_SITE_MAGE_TOWER
  | typeof RECRUIT_SITE_MONASTERY
  | typeof RECRUIT_SITE_CITY
  | typeof RECRUIT_SITE_CAMP;

// =============================================================================
// UNIT ABILITY CONSTANTS
// =============================================================================
export const UNIT_ABILITY_ATTACK = "attack" as const;
export const UNIT_ABILITY_BLOCK = "block" as const;
export const UNIT_ABILITY_RANGED_ATTACK = "ranged_attack" as const;
export const UNIT_ABILITY_SIEGE_ATTACK = "siege_attack" as const;
export const UNIT_ABILITY_MOVE = "move" as const;
export const UNIT_ABILITY_INFLUENCE = "influence" as const;
export const UNIT_ABILITY_HEAL = "heal" as const;
export const UNIT_ABILITY_SWIFT = "swift" as const;
export const UNIT_ABILITY_BRUTAL = "brutal" as const;
export const UNIT_ABILITY_POISON = "poison" as const;
export const UNIT_ABILITY_PARALYZE = "paralyze" as const;

export type UnitAbilityType =
  | typeof UNIT_ABILITY_ATTACK
  | typeof UNIT_ABILITY_BLOCK
  | typeof UNIT_ABILITY_RANGED_ATTACK
  | typeof UNIT_ABILITY_SIEGE_ATTACK
  | typeof UNIT_ABILITY_MOVE
  | typeof UNIT_ABILITY_INFLUENCE
  | typeof UNIT_ABILITY_HEAL
  | typeof UNIT_ABILITY_SWIFT
  | typeof UNIT_ABILITY_BRUTAL
  | typeof UNIT_ABILITY_POISON
  | typeof UNIT_ABILITY_PARALYZE;

// =============================================================================
// UNIT RESISTANCES
// =============================================================================
// Re-use EnemyResistances interface for consistency
import { type EnemyResistances, NO_RESISTANCES } from "./enemies/index.js";

export type UnitResistances = EnemyResistances;

// =============================================================================
// UNIT ABILITY INTERFACE
// =============================================================================
export interface UnitAbility {
  readonly type: UnitAbilityType;
  readonly value?: number;
  readonly element?: Element;
}

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
export const UNIT_ALTEM_MAGES = "altem_mages" as const;
export const UNIT_ALTEM_GUARDIANS = "altem_guardians" as const;
export const UNIT_DELPHANA_MASTERS = "delphana_masters" as const;

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
  | typeof UNIT_ALTEM_MAGES
  | typeof UNIT_ALTEM_GUARDIANS
  | typeof UNIT_DELPHANA_MASTERS;

// =============================================================================
// UNIT DEFINITION INTERFACE
// =============================================================================
export interface UnitDefinition {
  readonly id: UnitId;
  readonly name: string;
  readonly type: UnitType;
  readonly level: number; // 1-4
  readonly influence: number; // Cost to recruit
  readonly armor: number;
  readonly resistances: UnitResistances;
  readonly recruitSites: readonly RecruitSite[];
  readonly abilities: readonly UnitAbility[];
  readonly copies: number; // How many copies in deck
}

// =============================================================================
// UNIT DEFINITIONS
// =============================================================================
export const UNITS: Record<UnitId, UnitDefinition> = {
  // ===========================================================================
  // REGULAR UNITS - Level 1
  // ===========================================================================
  [UNIT_PEASANTS]: {
    id: UNIT_PEASANTS,
    name: "Peasants",
    type: UNIT_TYPE_REGULAR,
    level: 1,
    influence: 4,
    armor: 3,
    resistances: NO_RESISTANCES,
    recruitSites: [RECRUIT_SITE_VILLAGE],
    abilities: [
      { type: UNIT_ABILITY_ATTACK, value: 2, element: ELEMENT_PHYSICAL },
      { type: UNIT_ABILITY_BLOCK, value: 2, element: ELEMENT_PHYSICAL },
    ],
    copies: 3,
  },
  [UNIT_FORESTERS]: {
    id: UNIT_FORESTERS,
    name: "Foresters",
    type: UNIT_TYPE_REGULAR,
    level: 1,
    influence: 5,
    armor: 4,
    resistances: NO_RESISTANCES,
    recruitSites: [RECRUIT_SITE_VILLAGE],
    abilities: [
      { type: UNIT_ABILITY_BLOCK, value: 3, element: ELEMENT_PHYSICAL },
      { type: UNIT_ABILITY_RANGED_ATTACK, value: 2, element: ELEMENT_PHYSICAL },
    ],
    copies: 2,
  },
  [UNIT_HERBALIST]: {
    id: UNIT_HERBALIST,
    name: "Herbalist",
    type: UNIT_TYPE_REGULAR,
    level: 1,
    influence: 3,
    armor: 2,
    resistances: NO_RESISTANCES,
    recruitSites: [RECRUIT_SITE_VILLAGE, RECRUIT_SITE_MONASTERY],
    abilities: [{ type: UNIT_ABILITY_HEAL, value: 2 }],
    copies: 2,
  },
  [UNIT_SCOUTS]: {
    id: UNIT_SCOUTS,
    name: "Scouts",
    type: UNIT_TYPE_REGULAR,
    level: 1,
    influence: 4,
    armor: 2,
    resistances: NO_RESISTANCES,
    recruitSites: [
      RECRUIT_SITE_VILLAGE,
      RECRUIT_SITE_KEEP,
      RECRUIT_SITE_MAGE_TOWER,
      RECRUIT_SITE_MONASTERY,
      RECRUIT_SITE_CITY,
    ],
    abilities: [
      { type: UNIT_ABILITY_MOVE, value: 2 },
      { type: UNIT_ABILITY_INFLUENCE, value: 2 },
    ],
    copies: 2,
  },
  [UNIT_THUGS]: {
    id: UNIT_THUGS,
    name: "Thugs",
    type: UNIT_TYPE_REGULAR,
    level: 1,
    influence: 5,
    armor: 5,
    resistances: NO_RESISTANCES,
    recruitSites: [RECRUIT_SITE_VILLAGE, RECRUIT_SITE_KEEP],
    abilities: [
      { type: UNIT_ABILITY_ATTACK, value: 3, element: ELEMENT_PHYSICAL },
    ],
    copies: 2,
  },

  // ===========================================================================
  // REGULAR UNITS - Level 2
  // ===========================================================================
  [UNIT_UTEM_CROSSBOWMEN]: {
    id: UNIT_UTEM_CROSSBOWMEN,
    name: "Utem Crossbowmen",
    type: UNIT_TYPE_REGULAR,
    level: 2,
    influence: 6,
    armor: 4,
    resistances: NO_RESISTANCES,
    recruitSites: [RECRUIT_SITE_VILLAGE, RECRUIT_SITE_KEEP],
    abilities: [
      { type: UNIT_ABILITY_ATTACK, value: 3, element: ELEMENT_PHYSICAL },
      { type: UNIT_ABILITY_RANGED_ATTACK, value: 3, element: ELEMENT_PHYSICAL },
    ],
    copies: 2,
  },
  [UNIT_UTEM_GUARDSMEN]: {
    id: UNIT_UTEM_GUARDSMEN,
    name: "Utem Guardsmen",
    type: UNIT_TYPE_REGULAR,
    level: 2,
    influence: 5,
    armor: 5,
    resistances: NO_RESISTANCES,
    recruitSites: [RECRUIT_SITE_VILLAGE, RECRUIT_SITE_KEEP],
    abilities: [
      { type: UNIT_ABILITY_ATTACK, value: 2, element: ELEMENT_PHYSICAL },
      { type: UNIT_ABILITY_BLOCK, value: 4, element: ELEMENT_PHYSICAL },
    ],
    copies: 2,
  },
  [UNIT_UTEM_SWORDSMEN]: {
    id: UNIT_UTEM_SWORDSMEN,
    name: "Utem Swordsmen",
    type: UNIT_TYPE_REGULAR,
    level: 2,
    influence: 6,
    armor: 4,
    resistances: NO_RESISTANCES,
    recruitSites: [RECRUIT_SITE_KEEP],
    abilities: [
      { type: UNIT_ABILITY_ATTACK, value: 3, element: ELEMENT_PHYSICAL },
      { type: UNIT_ABILITY_BLOCK, value: 3, element: ELEMENT_PHYSICAL },
    ],
    copies: 2,
  },
  [UNIT_GUARDIAN_GOLEMS]: {
    id: UNIT_GUARDIAN_GOLEMS,
    name: "Guardian Golems",
    type: UNIT_TYPE_REGULAR,
    level: 2,
    influence: 7,
    armor: 3,
    resistances: { physical: true, fire: false, ice: false },
    recruitSites: [RECRUIT_SITE_MAGE_TOWER, RECRUIT_SITE_KEEP],
    abilities: [
      { type: UNIT_ABILITY_ATTACK, value: 2, element: ELEMENT_PHYSICAL },
      { type: UNIT_ABILITY_BLOCK, value: 2, element: ELEMENT_PHYSICAL },
    ],
    copies: 2,
  },
  [UNIT_ILLUSIONISTS]: {
    id: UNIT_ILLUSIONISTS,
    name: "Illusionists",
    type: UNIT_TYPE_REGULAR,
    level: 2,
    influence: 7,
    armor: 2,
    resistances: { physical: true, fire: false, ice: false },
    recruitSites: [RECRUIT_SITE_MAGE_TOWER, RECRUIT_SITE_MONASTERY],
    abilities: [
      { type: UNIT_ABILITY_INFLUENCE, value: 4 },
      { type: UNIT_ABILITY_BLOCK, value: 3, element: ELEMENT_PHYSICAL },
    ],
    copies: 2,
  },
  [UNIT_SHOCKTROOPS]: {
    id: UNIT_SHOCKTROOPS,
    name: "Shocktroops",
    type: UNIT_TYPE_REGULAR,
    level: 2,
    influence: 6,
    armor: 3,
    resistances: NO_RESISTANCES,
    recruitSites: [RECRUIT_SITE_KEEP],
    abilities: [
      { type: UNIT_ABILITY_ATTACK, value: 3, element: ELEMENT_PHYSICAL },
      { type: UNIT_ABILITY_SWIFT },
      { type: UNIT_ABILITY_BRUTAL },
    ],
    copies: 2,
  },
  [UNIT_RED_CAPE_MONKS]: {
    id: UNIT_RED_CAPE_MONKS,
    name: "Red Cape Monks",
    type: UNIT_TYPE_REGULAR,
    level: 2,
    influence: 7,
    armor: 4,
    resistances: NO_RESISTANCES,
    recruitSites: [RECRUIT_SITE_MONASTERY],
    abilities: [
      { type: UNIT_ABILITY_ATTACK, value: 4, element: ELEMENT_FIRE },
      { type: UNIT_ABILITY_BLOCK, value: 3, element: ELEMENT_FIRE },
    ],
    copies: 1,
  },
  [UNIT_NORTHERN_MONKS]: {
    id: UNIT_NORTHERN_MONKS,
    name: "Northern Monks",
    type: UNIT_TYPE_REGULAR,
    level: 2,
    influence: 7,
    armor: 4,
    resistances: NO_RESISTANCES,
    recruitSites: [RECRUIT_SITE_MONASTERY],
    abilities: [
      { type: UNIT_ABILITY_ATTACK, value: 4, element: ELEMENT_ICE },
      { type: UNIT_ABILITY_BLOCK, value: 3, element: ELEMENT_ICE },
    ],
    copies: 1,
  },
  [UNIT_SAVAGE_MONKS]: {
    id: UNIT_SAVAGE_MONKS,
    name: "Savage Monks",
    type: UNIT_TYPE_REGULAR,
    level: 2,
    influence: 7,
    armor: 4,
    resistances: NO_RESISTANCES,
    recruitSites: [RECRUIT_SITE_MONASTERY],
    abilities: [
      { type: UNIT_ABILITY_ATTACK, value: 4, element: ELEMENT_PHYSICAL },
      { type: UNIT_ABILITY_POISON },
    ],
    copies: 1,
  },
  [UNIT_MAGIC_FAMILIARS]: {
    id: UNIT_MAGIC_FAMILIARS,
    name: "Magic Familiars",
    type: UNIT_TYPE_REGULAR,
    level: 2,
    influence: 6,
    armor: 5,
    resistances: NO_RESISTANCES,
    recruitSites: [RECRUIT_SITE_MONASTERY, RECRUIT_SITE_MAGE_TOWER],
    abilities: [], // Special: provides bonus mana
    copies: 2,
  },

  // ===========================================================================
  // ELITE UNITS - Level 3
  // ===========================================================================
  [UNIT_FIRE_MAGES]: {
    id: UNIT_FIRE_MAGES,
    name: "Fire Mages",
    type: UNIT_TYPE_ELITE,
    level: 3,
    influence: 9,
    armor: 4,
    resistances: { physical: false, fire: true, ice: false },
    recruitSites: [RECRUIT_SITE_MAGE_TOWER, RECRUIT_SITE_MONASTERY],
    abilities: [
      { type: UNIT_ABILITY_ATTACK, value: 4, element: ELEMENT_FIRE },
      { type: UNIT_ABILITY_RANGED_ATTACK, value: 4, element: ELEMENT_FIRE },
    ],
    copies: 2,
  },
  [UNIT_ICE_MAGES]: {
    id: UNIT_ICE_MAGES,
    name: "Ice Mages",
    type: UNIT_TYPE_ELITE,
    level: 3,
    influence: 9,
    armor: 4,
    resistances: { physical: false, fire: false, ice: true },
    recruitSites: [RECRUIT_SITE_MAGE_TOWER, RECRUIT_SITE_MONASTERY],
    abilities: [
      { type: UNIT_ABILITY_ATTACK, value: 4, element: ELEMENT_ICE },
      { type: UNIT_ABILITY_RANGED_ATTACK, value: 4, element: ELEMENT_ICE },
    ],
    copies: 2,
  },
  [UNIT_FIRE_GOLEMS]: {
    id: UNIT_FIRE_GOLEMS,
    name: "Fire Golems",
    type: UNIT_TYPE_ELITE,
    level: 3,
    influence: 8,
    armor: 4,
    resistances: { physical: true, fire: true, ice: false },
    recruitSites: [RECRUIT_SITE_KEEP, RECRUIT_SITE_MAGE_TOWER],
    abilities: [
      { type: UNIT_ABILITY_ATTACK, value: 3, element: ELEMENT_FIRE },
      { type: UNIT_ABILITY_BLOCK, value: 3, element: ELEMENT_FIRE },
    ],
    copies: 2,
  },
  [UNIT_ICE_GOLEMS]: {
    id: UNIT_ICE_GOLEMS,
    name: "Ice Golems",
    type: UNIT_TYPE_ELITE,
    level: 3,
    influence: 8,
    armor: 4,
    resistances: { physical: true, fire: false, ice: true },
    recruitSites: [RECRUIT_SITE_KEEP, RECRUIT_SITE_MAGE_TOWER],
    abilities: [
      { type: UNIT_ABILITY_ATTACK, value: 3, element: ELEMENT_ICE },
      { type: UNIT_ABILITY_BLOCK, value: 3, element: ELEMENT_ICE },
      { type: UNIT_ABILITY_PARALYZE },
    ],
    copies: 2,
  },
  [UNIT_SORCERERS]: {
    id: UNIT_SORCERERS,
    name: "Sorcerers",
    type: UNIT_TYPE_ELITE,
    level: 3,
    influence: 9,
    armor: 4,
    resistances: { physical: false, fire: true, ice: true },
    recruitSites: [RECRUIT_SITE_MAGE_TOWER, RECRUIT_SITE_MONASTERY],
    abilities: [], // Special: provides two mana tokens
    copies: 2,
  },
  [UNIT_CATAPULTS]: {
    id: UNIT_CATAPULTS,
    name: "Catapults",
    type: UNIT_TYPE_ELITE,
    level: 3,
    influence: 9,
    armor: 4,
    resistances: NO_RESISTANCES,
    recruitSites: [RECRUIT_SITE_KEEP, RECRUIT_SITE_CITY],
    abilities: [
      { type: UNIT_ABILITY_SIEGE_ATTACK, value: 4, element: ELEMENT_PHYSICAL },
    ],
    copies: 3,
  },
  [UNIT_AMOTEP_GUNNERS]: {
    id: UNIT_AMOTEP_GUNNERS,
    name: "Amotep Gunners",
    type: UNIT_TYPE_ELITE,
    level: 3,
    influence: 8,
    armor: 6,
    resistances: NO_RESISTANCES,
    recruitSites: [RECRUIT_SITE_KEEP, RECRUIT_SITE_CITY],
    abilities: [
      { type: UNIT_ABILITY_RANGED_ATTACK, value: 3, element: ELEMENT_PHYSICAL },
      { type: UNIT_ABILITY_SIEGE_ATTACK, value: 3, element: ELEMENT_PHYSICAL },
    ],
    copies: 2,
  },
  [UNIT_AMOTEP_FREEZERS]: {
    id: UNIT_AMOTEP_FREEZERS,
    name: "Amotep Freezers",
    type: UNIT_TYPE_ELITE,
    level: 3,
    influence: 8,
    armor: 6,
    resistances: NO_RESISTANCES,
    recruitSites: [RECRUIT_SITE_KEEP, RECRUIT_SITE_CITY],
    abilities: [
      { type: UNIT_ABILITY_RANGED_ATTACK, value: 3, element: ELEMENT_ICE },
      { type: UNIT_ABILITY_SIEGE_ATTACK, value: 3, element: ELEMENT_ICE },
      { type: UNIT_ABILITY_PARALYZE },
    ],
    copies: 2,
  },
  [UNIT_HEROES]: {
    id: UNIT_HEROES,
    name: "Heroes",
    type: UNIT_TYPE_ELITE,
    level: 3,
    influence: 9,
    armor: 5, // Varies by card
    resistances: NO_RESISTANCES, // Varies by card
    recruitSites: [RECRUIT_SITE_VILLAGE, RECRUIT_SITE_KEEP, RECRUIT_SITE_CITY],
    abilities: [], // Varies by card
    copies: 4,
  },

  // ===========================================================================
  // ELITE UNITS - Level 4
  // ===========================================================================
  [UNIT_ALTEM_MAGES]: {
    id: UNIT_ALTEM_MAGES,
    name: "Altem Mages",
    type: UNIT_TYPE_ELITE,
    level: 4,
    influence: 12,
    armor: 5,
    resistances: { physical: false, fire: true, ice: true },
    recruitSites: [RECRUIT_SITE_KEEP, RECRUIT_SITE_CITY],
    abilities: [
      { type: UNIT_ABILITY_ATTACK, value: 5, element: ELEMENT_FIRE },
      { type: UNIT_ABILITY_ATTACK, value: 5, element: ELEMENT_ICE },
    ],
    copies: 2,
  },
  [UNIT_ALTEM_GUARDIANS]: {
    id: UNIT_ALTEM_GUARDIANS,
    name: "Altem Guardians",
    type: UNIT_TYPE_ELITE,
    level: 4,
    influence: 11,
    armor: 7,
    resistances: NO_RESISTANCES,
    recruitSites: [RECRUIT_SITE_CITY],
    abilities: [
      { type: UNIT_ABILITY_ATTACK, value: 5, element: ELEMENT_PHYSICAL },
      { type: UNIT_ABILITY_BLOCK, value: 5, element: ELEMENT_PHYSICAL },
    ],
    copies: 3,
  },
  [UNIT_DELPHANA_MASTERS]: {
    id: UNIT_DELPHANA_MASTERS,
    name: "Delphana Masters",
    type: UNIT_TYPE_ELITE,
    level: 4,
    influence: 13,
    armor: 3,
    resistances: { physical: true, fire: true, ice: true },
    recruitSites: [RECRUIT_SITE_CITY],
    abilities: [], // Special: copy any unit ability
    copies: 2,
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================
export function getUnit(id: UnitId): UnitDefinition {
  return UNITS[id];
}

export function getUnitsByType(type: UnitType): UnitDefinition[] {
  return Object.values(UNITS).filter((u) => u.type === type);
}

export function getRegularUnits(): UnitDefinition[] {
  return getUnitsByType(UNIT_TYPE_REGULAR);
}

export function getEliteUnits(): UnitDefinition[] {
  return getUnitsByType(UNIT_TYPE_ELITE);
}

export function getUnitsByLevel(level: number): UnitDefinition[] {
  return Object.values(UNITS).filter((u) => u.level === level);
}

export function canRecruitAt(unit: UnitDefinition, site: RecruitSite): boolean {
  return unit.recruitSites.includes(site);
}
