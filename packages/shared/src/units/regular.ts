/**
 * Regular unit definitions (Level 1 & Level 2) for Mage Knight
 *
 * Data extracted from Mage Knight Plus TTS mod
 * https://steamcommunity.com/sharedfiles/filedetails/?id=2127352568
 */

import {
  ELEMENT_PHYSICAL,
  ELEMENT_FIRE,
  ELEMENT_ICE,
} from "../elements.js";
import { RESIST_PHYSICAL } from "../enemies/index.js";
import type { UnitDefinition } from "./types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_VILLAGE,
  RECRUIT_SITE_KEEP,
  RECRUIT_SITE_MAGE_TOWER,
  RECRUIT_SITE_MONASTERY,
  RECRUIT_SITE_CITY,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_RANGED_ATTACK,
  UNIT_ABILITY_MOVE,
  UNIT_ABILITY_INFLUENCE,
  UNIT_ABILITY_HEAL,
  UNIT_ABILITY_SWIFT,
  UNIT_ABILITY_BRUTAL,
  UNIT_ABILITY_POISON,
} from "./constants.js";
import {
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
} from "./ids.js";

// =============================================================================
// REGULAR UNIT IDS (for typing the record)
// =============================================================================
type RegularUnitId =
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
  | typeof UNIT_MAGIC_FAMILIARS;

// =============================================================================
// REGULAR UNITS - Level 1 & Level 2
// =============================================================================
export const REGULAR_UNITS: Record<RegularUnitId, UnitDefinition> = {
  // ===========================================================================
  // LEVEL 1
  // ===========================================================================
  [UNIT_PEASANTS]: {
    id: UNIT_PEASANTS,
    name: "Peasants",
    type: UNIT_TYPE_REGULAR,
    level: 1,
    influence: 4,
    armor: 3,
    resistances: [],
    recruitSites: [RECRUIT_SITE_VILLAGE],
    abilities: [
      { type: UNIT_ABILITY_ATTACK, value: 2, element: ELEMENT_PHYSICAL },
      { type: UNIT_ABILITY_BLOCK, value: 2, element: ELEMENT_PHYSICAL },
      { type: UNIT_ABILITY_INFLUENCE, value: 2 },
      { type: UNIT_ABILITY_MOVE, value: 2 },
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
    resistances: [],
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
    resistances: [],
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
    resistances: [],
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
    resistances: [],
    recruitSites: [RECRUIT_SITE_VILLAGE, RECRUIT_SITE_KEEP],
    abilities: [
      { type: UNIT_ABILITY_ATTACK, value: 3, element: ELEMENT_PHYSICAL },
    ],
    copies: 2,
  },

  // ===========================================================================
  // LEVEL 2
  // ===========================================================================
  [UNIT_UTEM_CROSSBOWMEN]: {
    id: UNIT_UTEM_CROSSBOWMEN,
    name: "Utem Crossbowmen",
    type: UNIT_TYPE_REGULAR,
    level: 2,
    influence: 6,
    armor: 4,
    resistances: [],
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
    resistances: [],
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
    resistances: [],
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
    resistances: [RESIST_PHYSICAL],
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
    resistances: [RESIST_PHYSICAL],
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
    resistances: [],
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
    resistances: [],
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
    resistances: [],
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
    resistances: [],
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
    resistances: [],
    recruitSites: [RECRUIT_SITE_MONASTERY, RECRUIT_SITE_MAGE_TOWER],
    abilities: [], // Special: provides bonus mana
    copies: 2,
  },
};
