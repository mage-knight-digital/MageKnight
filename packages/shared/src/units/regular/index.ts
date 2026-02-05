/**
 * Regular unit definitions (Level 1 & Level 2) for Mage Knight
 *
 * Data extracted from Mage Knight Plus TTS mod
 * https://steamcommunity.com/sharedfiles/filedetails/?id=2127352568
 */

import type { UnitDefinition } from "../types.js";
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
} from "../ids.js";

// =============================================================================
// RE-EXPORT INDIVIDUAL UNITS
// =============================================================================

export { PEASANTS } from "./peasants.js";
export { FORESTERS } from "./foresters.js";
export { HERBALIST } from "./herbalist.js";
export { SCOUTS } from "./scouts.js";
export { THUGS } from "./thugs.js";
export { UTEM_CROSSBOWMEN } from "./utemCrossbowmen.js";
export { UTEM_GUARDSMEN } from "./utemGuardsmen.js";
export { UTEM_SWORDSMEN } from "./utemSwordsmen.js";
export { GUARDIAN_GOLEMS } from "./guardianGolems.js";
export { ILLUSIONISTS } from "./illusionists.js";
export {
  SHOCKTROOPS,
  SHOCKTROOPS_COORDINATED_FIRE,
  SHOCKTROOPS_WEAKEN_ENEMY,
  SHOCKTROOPS_TAUNT,
} from "./shocktroops.js";
export { RED_CAPE_MONKS } from "./redCapeMonks.js";
export { NORTHERN_MONKS } from "./northernMonks.js";
export { SAVAGE_MONKS } from "./savageMonks.js";
export { MAGIC_FAMILIARS } from "./magicFamiliars.js";

// =============================================================================
// IMPORT FOR AGGREGATION
// =============================================================================

import { PEASANTS } from "./peasants.js";
import { FORESTERS } from "./foresters.js";
import { HERBALIST } from "./herbalist.js";
import { SCOUTS } from "./scouts.js";
import { THUGS } from "./thugs.js";
import { UTEM_CROSSBOWMEN } from "./utemCrossbowmen.js";
import { UTEM_GUARDSMEN } from "./utemGuardsmen.js";
import { UTEM_SWORDSMEN } from "./utemSwordsmen.js";
import { GUARDIAN_GOLEMS } from "./guardianGolems.js";
import { ILLUSIONISTS } from "./illusionists.js";
import { SHOCKTROOPS } from "./shocktroops.js";
import { RED_CAPE_MONKS } from "./redCapeMonks.js";
import { NORTHERN_MONKS } from "./northernMonks.js";
import { SAVAGE_MONKS } from "./savageMonks.js";
import { MAGIC_FAMILIARS } from "./magicFamiliars.js";

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
// REGULAR UNITS AGGREGATE
// =============================================================================

export const REGULAR_UNITS: Record<RegularUnitId, UnitDefinition> = {
  [UNIT_PEASANTS]: PEASANTS,
  [UNIT_FORESTERS]: FORESTERS,
  [UNIT_HERBALIST]: HERBALIST,
  [UNIT_SCOUTS]: SCOUTS,
  [UNIT_THUGS]: THUGS,
  [UNIT_UTEM_CROSSBOWMEN]: UTEM_CROSSBOWMEN,
  [UNIT_UTEM_GUARDSMEN]: UTEM_GUARDSMEN,
  [UNIT_UTEM_SWORDSMEN]: UTEM_SWORDSMEN,
  [UNIT_GUARDIAN_GOLEMS]: GUARDIAN_GOLEMS,
  [UNIT_ILLUSIONISTS]: ILLUSIONISTS,
  [UNIT_SHOCKTROOPS]: SHOCKTROOPS,
  [UNIT_RED_CAPE_MONKS]: RED_CAPE_MONKS,
  [UNIT_NORTHERN_MONKS]: NORTHERN_MONKS,
  [UNIT_SAVAGE_MONKS]: SAVAGE_MONKS,
  [UNIT_MAGIC_FAMILIARS]: MAGIC_FAMILIARS,
};
