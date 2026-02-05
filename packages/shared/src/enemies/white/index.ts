/**
 * White Enemy Definitions - City Garrison
 *
 * White enemies defend cities and are among the strongest non-dragon
 * enemies. Fame ranges from 5-9. They include the powerful Altem forces.
 */

import type { EnemyDefinition } from "../types.js";

// Re-export individual enemies
export { ENEMY_THUGS, THUGS } from "./thugs.js";
export { ENEMY_SHOCKTROOPS, SHOCKTROOPS } from "./shocktroops.js";
export { ENEMY_FREEZERS, FREEZERS } from "./freezers.js";
export { ENEMY_GUNNERS, GUNNERS } from "./gunners.js";
export { ENEMY_FIRE_CATAPULT, FIRE_CATAPULT } from "./fire-catapult.js";
export { ENEMY_ALTEM_GUARDSMEN, ALTEM_GUARDSMEN } from "./altem-guardsmen.js";
export { ENEMY_ALTEM_MAGES, ALTEM_MAGES } from "./altem-mages.js";
export { ENEMY_DELPHANA_MASTERS, DELPHANA_MASTERS } from "./delphana-masters.js";
export { ENEMY_GRIM_LEGIONNARIES, GRIM_LEGIONNARIES } from "./grim-legionnaries.js";

// Import for aggregation
import { ENEMY_THUGS, THUGS } from "./thugs.js";
import { ENEMY_SHOCKTROOPS, SHOCKTROOPS } from "./shocktroops.js";
import { ENEMY_FREEZERS, FREEZERS } from "./freezers.js";
import { ENEMY_GUNNERS, GUNNERS } from "./gunners.js";
import { ENEMY_FIRE_CATAPULT, FIRE_CATAPULT } from "./fire-catapult.js";
import { ENEMY_ALTEM_GUARDSMEN, ALTEM_GUARDSMEN } from "./altem-guardsmen.js";
import { ENEMY_ALTEM_MAGES, ALTEM_MAGES } from "./altem-mages.js";
import { ENEMY_DELPHANA_MASTERS, DELPHANA_MASTERS } from "./delphana-masters.js";
import { ENEMY_GRIM_LEGIONNARIES, GRIM_LEGIONNARIES } from "./grim-legionnaries.js";

/**
 * Union type of all white (City garrison) enemy IDs
 */
export type WhiteEnemyId =
  | typeof ENEMY_THUGS
  | typeof ENEMY_SHOCKTROOPS
  | typeof ENEMY_FREEZERS
  | typeof ENEMY_GUNNERS
  | typeof ENEMY_FIRE_CATAPULT
  | typeof ENEMY_ALTEM_GUARDSMEN
  | typeof ENEMY_ALTEM_MAGES
  | typeof ENEMY_DELPHANA_MASTERS
  | typeof ENEMY_GRIM_LEGIONNARIES;

/** All white (City garrison) enemies */
export const WHITE_ENEMIES: Record<WhiteEnemyId, EnemyDefinition> = {
  [ENEMY_THUGS]: THUGS,
  [ENEMY_SHOCKTROOPS]: SHOCKTROOPS,
  [ENEMY_FREEZERS]: FREEZERS,
  [ENEMY_GUNNERS]: GUNNERS,
  [ENEMY_FIRE_CATAPULT]: FIRE_CATAPULT,
  [ENEMY_ALTEM_GUARDSMEN]: ALTEM_GUARDSMEN,
  [ENEMY_ALTEM_MAGES]: ALTEM_MAGES,
  [ENEMY_DELPHANA_MASTERS]: DELPHANA_MASTERS,
  [ENEMY_GRIM_LEGIONNARIES]: GRIM_LEGIONNARIES,
};
