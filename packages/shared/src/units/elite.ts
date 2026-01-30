/**
 * Elite unit definitions (Level 3 & Level 4) for Mage Knight
 *
 * Data extracted from Mage Knight Plus TTS mod
 * https://steamcommunity.com/sharedfiles/filedetails/?id=2127352568
 */

import {
  ELEMENT_PHYSICAL,
  ELEMENT_FIRE,
  ELEMENT_ICE,
} from "../elements.js";
import { RESIST_PHYSICAL, RESIST_FIRE, RESIST_ICE } from "../enemies/index.js";
import type { UnitDefinition } from "./types.js";
import {
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_VILLAGE,
  RECRUIT_SITE_KEEP,
  RECRUIT_SITE_MAGE_TOWER,
  RECRUIT_SITE_MONASTERY,
  RECRUIT_SITE_CITY,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_RANGED_ATTACK,
  UNIT_ABILITY_SIEGE_ATTACK,
  UNIT_ABILITY_PARALYZE,
} from "./constants.js";
import {
  UNIT_FIRE_MAGES,
  UNIT_ICE_MAGES,
  UNIT_FIRE_GOLEMS,
  UNIT_ICE_GOLEMS,
  UNIT_SORCERERS,
  UNIT_CATAPULTS,
  UNIT_AMOTEP_GUNNERS,
  UNIT_AMOTEP_FREEZERS,
  UNIT_HEROES,
  UNIT_ALTEM_MAGES,
  UNIT_ALTEM_GUARDIANS,
  UNIT_DELPHANA_MASTERS,
} from "./ids.js";

// =============================================================================
// ELITE UNIT IDS (for typing the record)
// =============================================================================
type EliteUnitId =
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
// ELITE UNITS - Level 3 & Level 4
// =============================================================================
export const ELITE_UNITS: Record<EliteUnitId, UnitDefinition> = {
  // ===========================================================================
  // LEVEL 3
  // ===========================================================================
  [UNIT_FIRE_MAGES]: {
    id: UNIT_FIRE_MAGES,
    name: "Fire Mages",
    type: UNIT_TYPE_ELITE,
    level: 3,
    influence: 9,
    armor: 4,
    resistances: [RESIST_FIRE],
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
    resistances: [RESIST_ICE],
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
    resistances: [RESIST_PHYSICAL, RESIST_FIRE],
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
    resistances: [RESIST_PHYSICAL, RESIST_ICE],
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
    resistances: [RESIST_FIRE, RESIST_ICE],
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
    resistances: [],
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
    resistances: [],
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
    resistances: [],
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
    resistances: [], // Varies by card
    recruitSites: [RECRUIT_SITE_VILLAGE, RECRUIT_SITE_KEEP, RECRUIT_SITE_CITY],
    abilities: [], // Varies by card
    copies: 4,
  },

  // ===========================================================================
  // LEVEL 4
  // ===========================================================================
  [UNIT_ALTEM_MAGES]: {
    id: UNIT_ALTEM_MAGES,
    name: "Altem Mages",
    type: UNIT_TYPE_ELITE,
    level: 4,
    influence: 12,
    armor: 5,
    resistances: [RESIST_FIRE, RESIST_ICE],
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
    resistances: [],
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
    resistances: [RESIST_PHYSICAL, RESIST_FIRE, RESIST_ICE],
    recruitSites: [RECRUIT_SITE_CITY],
    abilities: [], // Special: copy any unit ability
    copies: 2,
  },
};
