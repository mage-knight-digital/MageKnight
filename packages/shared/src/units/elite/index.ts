/**
 * Elite unit definitions (Level 3 & Level 4) for Mage Knight
 *
 * Data extracted from Mage Knight Plus TTS mod
 * https://steamcommunity.com/sharedfiles/filedetails/?id=2127352568
 */

import type { UnitDefinition } from "../types.js";
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
} from "../ids.js";

// =============================================================================
// RE-EXPORT INDIVIDUAL UNITS
// =============================================================================

export { FIRE_MAGES } from "./fireMages.js";
export { ICE_MAGES } from "./iceMages.js";
export { FIRE_GOLEMS } from "./fireGolems.js";
export { ICE_GOLEMS } from "./iceGolems.js";
export { SORCERERS } from "./sorcerers.js";
export { CATAPULTS } from "./catapults.js";
export { AMOTEP_GUNNERS } from "./amotepGunners.js";
export { AMOTEP_FREEZERS } from "./amotepFreezers.js";
export { HEROES } from "./heroes.js";
export { ALTEM_MAGES } from "./altemMages.js";
export { ALTEM_GUARDIANS } from "./altemGuardians.js";
export { DELPHANA_MASTERS } from "./delphanaMasters.js";

// =============================================================================
// IMPORT FOR AGGREGATION
// =============================================================================

import { FIRE_MAGES } from "./fireMages.js";
import { ICE_MAGES } from "./iceMages.js";
import { FIRE_GOLEMS } from "./fireGolems.js";
import { ICE_GOLEMS } from "./iceGolems.js";
import { SORCERERS } from "./sorcerers.js";
import { CATAPULTS } from "./catapults.js";
import { AMOTEP_GUNNERS } from "./amotepGunners.js";
import { AMOTEP_FREEZERS } from "./amotepFreezers.js";
import { HEROES } from "./heroes.js";
import { ALTEM_MAGES } from "./altemMages.js";
import { ALTEM_GUARDIANS } from "./altemGuardians.js";
import { DELPHANA_MASTERS } from "./delphanaMasters.js";

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
// ELITE UNITS AGGREGATE
// =============================================================================

export const ELITE_UNITS: Record<EliteUnitId, UnitDefinition> = {
  [UNIT_FIRE_MAGES]: FIRE_MAGES,
  [UNIT_ICE_MAGES]: ICE_MAGES,
  [UNIT_FIRE_GOLEMS]: FIRE_GOLEMS,
  [UNIT_ICE_GOLEMS]: ICE_GOLEMS,
  [UNIT_SORCERERS]: SORCERERS,
  [UNIT_CATAPULTS]: CATAPULTS,
  [UNIT_AMOTEP_GUNNERS]: AMOTEP_GUNNERS,
  [UNIT_AMOTEP_FREEZERS]: AMOTEP_FREEZERS,
  [UNIT_HEROES]: HEROES,
  [UNIT_ALTEM_MAGES]: ALTEM_MAGES,
  [UNIT_ALTEM_GUARDIANS]: ALTEM_GUARDIANS,
  [UNIT_DELPHANA_MASTERS]: DELPHANA_MASTERS,
};
